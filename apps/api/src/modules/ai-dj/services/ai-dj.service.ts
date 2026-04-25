import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AiDjActionDto,
  ChatSessionMessageDto,
  ChatSurfaceContextDto,
  ChatTurnRequestDto,
  ChatTurnResponseDto,
} from '@music-ai/shared';
import {
  ChatRole,
  MessageType,
  Prisma,
  SessionMode,
  type ChatMessage,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/services/auth.service';
import { ContentService } from '../../content/services/content.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationService } from '../../recommendation/services/recommendation.service';

type ReplyInput = ChatTurnRequestDto & {
  user?: AuthenticatedUser;
  timezoneHeader?: string;
};

type ResolvedIntent =
  | 'queue_replace'
  | 'queue_append'
  | 'recommend_explain'
  | 'theme_playlist_preview';

type ReplyPlan = {
  intent: ResolvedIntent;
  replyText: string;
  actions: AiDjActionDto[];
  trace: Record<string, unknown>;
};

@Injectable()
export class AiDjService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
    private readonly recommendationService: RecommendationService,
  ) {}

  async reply(input: ReplyInput): Promise<ChatTurnResponseDto> {
    const message = input.message.trim();
    if (!message) {
      throw new BadRequestException('message is required');
    }

    if (input.responseMode !== 'sync') {
      throw new BadRequestException('Only sync responseMode is supported');
    }

    const plan = await this.composeReplyPlan(
      message,
      input.surfaceContext,
      input.user?.id,
      input.timezoneHeader,
    );

    if (!input.user?.id) {
      return {
        sessionId: input.sessionId ?? this.createAnonymousSessionId(),
        messageId: this.createAnonymousMessageId(),
        replyText: plan.replyText,
        actions: plan.actions,
      };
    }

    const persisted = await this.persistTurn({
      userId: input.user.id,
      sessionId: input.sessionId,
      userMessage: message,
      assistantReply: plan.replyText,
      assistantActions: plan.actions,
      trace: {
        ...plan.trace,
        surfaceContext: input.surfaceContext ?? {},
      },
      timezoneHeader: input.timezoneHeader,
    });

    return {
      sessionId: persisted.sessionId,
      messageId: persisted.messageId,
      replyText: plan.replyText,
      actions: plan.actions,
    };
  }

  async getSessionMessages(
    sessionId: string,
    userId: string,
  ): Promise<ChatSessionMessageDto[]> {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
      include: {
        messages: {
          where: {
            role: {
              in: [ChatRole.USER, ChatRole.ASSISTANT],
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Chat session was not found');
    }

    return session.messages.map((message) => this.toSessionMessageDto(message));
  }

  private async persistTurn(input: {
    userId: string;
    sessionId?: string;
    userMessage: string;
    assistantReply: string;
    assistantActions: AiDjActionDto[];
    trace: Record<string, unknown>;
    timezoneHeader?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const contextSnapshot = await tx.contextSnapshot.create({
        data: {
          userId: input.userId,
          timezone: this.resolveTimezone(input.timezoneHeader),
          localTime: this.resolveLocalTime(input.timezoneHeader),
        },
      });

      let session = input.sessionId
        ? await tx.chatSession.findFirst({
            where: {
              id: input.sessionId,
              userId: input.userId,
              deletedAt: null,
            },
          })
        : null;

      if (!session) {
        session = await tx.chatSession.create({
          data: {
            userId: input.userId,
            title: this.buildSessionTitle(input.userMessage),
            sessionMode: SessionMode.TEXT,
            lastMessageAt: new Date(),
            contextSnapshotId: contextSnapshot.id,
          },
        });
      } else {
        session = await tx.chatSession.update({
          where: { id: session.id },
          data: {
            lastMessageAt: new Date(),
            contextSnapshotId: contextSnapshot.id,
          },
        });
      }

      await tx.chatMessage.create({
        data: {
          chatSessionId: session.id,
          role: ChatRole.USER,
          messageType: MessageType.TEXT,
          contentText: input.userMessage,
        },
      });

      const assistantMessage = await tx.chatMessage.create({
        data: {
          chatSessionId: session.id,
          role: ChatRole.ASSISTANT,
          messageType:
            input.assistantActions.length > 0
              ? MessageType.ACTION
              : MessageType.TEXT,
          contentText: input.assistantReply,
          contentJson:
            input.assistantActions.length > 0
              ? ({
                  actions:
                    input.assistantActions as unknown as Prisma.InputJsonValue,
                } satisfies Prisma.InputJsonObject)
              : undefined,
          traceJson: input.trace as Prisma.InputJsonObject,
        },
      });

      return {
        sessionId: session.id,
        messageId: assistantMessage.id,
      };
    });
  }

  private async composeReplyPlan(
    message: string,
    surfaceContext: ChatSurfaceContextDto | undefined,
    userId?: string,
    timezoneHeader?: string,
  ): Promise<ReplyPlan> {
    const normalized = message.trim().toLowerCase();
    const intent = this.detectIntent(normalized);
    const queueIds = surfaceContext?.queueContentIds ?? [];

    switch (intent) {
      case 'queue_append': {
        const contentIds = (await this.resolveContentIds(normalized)).filter(
          (contentId) => !queueIds.includes(contentId),
        );
        const picks = contentIds.slice(0, 2);
        return {
          intent,
          replyText:
            picks.length > 0
              ? '我在当前队列后面补两段相近但不抢戏的内容，让这条听感线继续往前走。'
              : '这轮我没有找到适合继续追加的内容，先保持当前队列不动。',
          actions:
            picks.length > 0
              ? [
                  {
                    type: 'queue_append',
                    payload: { contentIds: picks },
                  },
                ]
              : [],
          trace: {
            intent,
            matchedContentIds: picks,
          },
        };
      }
      case 'recommend_explain': {
        const replyText = await this.buildExplanationReply(
          normalized,
          surfaceContext,
          userId,
          timezoneHeader,
        );
        return {
          intent,
          replyText,
          actions: [],
          trace: {
            intent,
            currentTrackId: surfaceContext?.currentTrackId ?? null,
          },
        };
      }
      case 'theme_playlist_preview': {
        const picks = (await this.resolveContentIds(normalized)).slice(0, 3);
        return {
          intent,
          replyText:
            picks.length > 0
              ? '我先把这个主题压成一组可直接上机的预览队列，你先听走向，再决定要不要继续扩写。'
              : '这轮主题还不够清晰，我先保留当前频道。你可以补一句语种、场景或时间段。',
          actions:
            picks.length > 0
              ? [
                  {
                    type: 'queue_replace',
                    payload: { contentIds: picks },
                  },
                ]
              : [],
          trace: {
            intent,
            matchedContentIds: picks,
          },
        };
      }
      case 'queue_replace':
      default: {
        const picks = (await this.resolveContentIds(normalized)).slice(0, 3);
        return {
          intent: 'queue_replace',
          replyText:
            picks.length > 0
              ? '收到。我把主频道切到更贴近你这句指令的航线，先用三段内容把新的听感重心立住。'
              : '我还没锁定足够明确的方向，先不动当前队列。你可以再补一句语种、场景或风格。',
          actions:
            picks.length > 0
              ? [
                  {
                    type: 'queue_replace',
                    payload: { contentIds: picks },
                  },
                ]
              : [],
          trace: {
            intent: 'queue_replace',
            matchedContentIds: picks,
          },
        };
      }
    }
  }

  private async buildExplanationReply(
    normalizedMessage: string,
    surfaceContext: ChatSurfaceContextDto | undefined,
    userId?: string,
    timezoneHeader?: string,
  ) {
    if (surfaceContext?.currentTrackId) {
      const currentTrack = await this.contentService.getById(
        surfaceContext.currentTrackId,
      );
      if (currentTrack) {
        const languageCue =
          currentTrack.language === 'zh'
            ? '中文声线把夜色拉近'
            : currentTrack.language === 'instrumental'
              ? '没有人声会让专注区更稳定'
              : '英文词面留白更多，适合做背景而不抢注意力';

        return `这首 ${currentTrack.title} 现在成立，主要是因为它的速度和密度都比较克制，${languageCue}。如果你想，我下一轮可以按它继续往更冷、更亮或者更城市化的方向扩。`;
      }
    }

    if (userId) {
      const recommendation =
        await this.recommendationService.getNowRecommendation(
          userId,
          timezoneHeader,
        );
      const lead = recommendation.items[0];
      if (lead) {
        return `当前这组推荐的核心判断是：${recommendation.explanation}。我把第一首先落在 ${lead.title}，因为它最能把现在这条收听轨道定住。`;
      }
    }

    if (normalizedMessage.includes('推荐')) {
      return '这轮推荐的逻辑更偏向当前时间段和你最近的收听走向，所以我会优先给出稳定、可连续播放的内容，而不是一次性把探索幅度拉得太大。';
    }

    return '我现在更看重的是当前频道的连续性，所以会优先解释这条听感线为什么成立，再决定要不要整体切换。';
  }

  private detectIntent(normalizedMessage: string): ResolvedIntent {
    if (
      normalizedMessage.includes('为什么') ||
      normalizedMessage.includes('why') ||
      normalizedMessage.includes('解释') ||
      normalizedMessage.includes('背后')
    ) {
      return 'recommend_explain';
    }

    if (
      normalizedMessage.includes('加') ||
      normalizedMessage.includes('再来') ||
      normalizedMessage.includes('append') ||
      normalizedMessage.includes('补')
    ) {
      return 'queue_append';
    }

    if (
      normalizedMessage.includes('歌单') ||
      normalizedMessage.includes('playlist') ||
      normalizedMessage.includes('来几首') ||
      normalizedMessage.includes('一组') ||
      normalizedMessage.includes('做一份')
    ) {
      return 'theme_playlist_preview';
    }

    return 'queue_replace';
  }

  private async resolveContentIds(normalizedMessage: string) {
    const pools: string[][] = [];

    if (
      normalizedMessage.includes('粤语') ||
      normalizedMessage.includes('cantopop') ||
      normalizedMessage.includes('港')
    ) {
      pools.push(['cnt_canton_midnight', 'cnt_canto_neon', 'cnt_city_rain']);
    }

    if (
      normalizedMessage.includes('podcast') ||
      normalizedMessage.includes('播客') ||
      normalizedMessage.includes('brief')
    ) {
      pools.push(['cnt_podcast_brief', 'cnt_editorial_dusk', 'cnt_focus_fm']);
    }

    if (
      normalizedMessage.includes('morning') ||
      normalizedMessage.includes('早') ||
      normalizedMessage.includes('通勤')
    ) {
      pools.push(['cnt_morning_wire', 'cnt_editorial_dusk', 'cnt_city_rain']);
    }

    if (
      normalizedMessage.includes('focus') ||
      normalizedMessage.includes('工作') ||
      normalizedMessage.includes('写') ||
      normalizedMessage.includes('code') ||
      normalizedMessage.includes('专注')
    ) {
      pools.push(['cnt_focus_fm', 'cnt_afterhours_loop', 'cnt_editorial_dusk']);
    }

    if (
      normalizedMessage.includes('夜') ||
      normalizedMessage.includes('late') ||
      normalizedMessage.includes('深夜') ||
      normalizedMessage.includes('midnight')
    ) {
      pools.push([
        'cnt_canton_midnight',
        'cnt_afterhours_loop',
        'cnt_city_rain',
      ]);
    }

    if (
      normalizedMessage.includes('radio') ||
      normalizedMessage.includes('电台') ||
      normalizedMessage.includes('signal')
    ) {
      pools.push(['cnt_focus_fm', 'cnt_podcast_brief', 'cnt_editorial_dusk']);
    }

    pools.push(['cnt_editorial_dusk', 'cnt_focus_fm', 'cnt_afterhours_loop']);

    const merged = [...new Set(pools.flat())];
    const validIds = (await this.contentService.getByIds(merged)).map(
      (item) => item.id,
    );

    return validIds;
  }

  private toSessionMessageDto(message: ChatMessage): ChatSessionMessageDto {
    return {
      id: message.id,
      role: message.role === ChatRole.USER ? 'user' : 'assistant',
      messageType:
        message.messageType === MessageType.ACTION ? 'action' : 'text',
      text: message.contentText ?? '',
      createdAt: message.createdAt.toISOString(),
    };
  }

  private buildSessionTitle(message: string) {
    return message.trim().slice(0, 48);
  }

  private resolveTimezone(timezoneHeader?: string) {
    return timezoneHeader?.trim() || 'UTC';
  }

  private resolveLocalTime(timezoneHeader?: string) {
    const timezone = this.resolveTimezone(timezoneHeader);
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(new Date());
      const valueOf = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? '00';

      return new Date(
        `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}T${valueOf('hour')}:${valueOf('minute')}:${valueOf('second')}Z`,
      );
    } catch {
      return new Date();
    }
  }

  private createAnonymousSessionId() {
    return `anon_${Date.now().toString(36)}`;
  }

  private createAnonymousMessageId() {
    return `msg_${Date.now().toString(36)}`;
  }
}
