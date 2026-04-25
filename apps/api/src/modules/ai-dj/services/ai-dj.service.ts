import {
  BadRequestException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import type {
  AiDjActionDto,
  AiDjIntent,
  AiDjStreamActionsEventDto,
  AiDjStreamChunkEventDto,
  AiDjStreamDoneEventDto,
  ChatSessionMessageDto,
  ChatSurfaceContextDto,
  ChatTurnRequestDto,
  ChatTurnResponseDto,
  SaveAiPlaylistResponseDto,
} from '@music-ai/shared';
import {
  ChatRole,
  MessageType,
  PlaylistType,
  Prisma,
  SessionMode,
  type ChatMessage,
} from '@prisma/client';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../../auth/services/auth.service';
import { ContentService } from '../../content/services/content.service';
import { LibraryService } from '../../library/services/library.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationService } from '../../recommendation/services/recommendation.service';

type ReplyInput = ChatTurnRequestDto & {
  user?: AuthenticatedUser;
  timezoneHeader?: string;
};

type ResolvedIntent = AiDjIntent;

type ReplyPlan = {
  intent: ResolvedIntent;
  replyText: string;
  actions: AiDjActionDto[];
  trace: Record<string, unknown>;
};

type StreamPayload = {
  sessionId: string;
  messageId: string;
  replyText: string;
  actions: AiDjActionDto[];
  userId?: string;
  createdAt: number;
};

@Injectable()
export class AiDjService {
  private readonly streamPayloads = new Map<string, StreamPayload>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
    private readonly recommendationService: RecommendationService,
    private readonly libraryService: LibraryService,
  ) {}

  async reply(input: ReplyInput): Promise<ChatTurnResponseDto> {
    const message = input.message.trim();
    if (!message) {
      throw new BadRequestException('message is required');
    }
    this.pruneAnonymousStreamPayloads();

    const plan = await this.composeReplyPlan(
      message,
      input.surfaceContext,
      input.user?.id,
      input.timezoneHeader,
    );

    if (!input.user?.id) {
      const response = {
        sessionId: input.sessionId ?? this.createAnonymousSessionId(),
        messageId: this.createAnonymousMessageId(),
        intent: plan.intent,
        replyText: plan.replyText,
        actions: plan.actions,
      };
      this.registerStreamPayload({
        ...response,
        createdAt: Date.now(),
      });
      return response;
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

    const response = {
      sessionId: persisted.sessionId,
      messageId: persisted.messageId,
      intent: plan.intent,
      replyText: plan.replyText,
      actions: plan.actions,
    };

    this.registerStreamPayload({
      ...response,
      userId: input.user.id,
      createdAt: Date.now(),
    });

    return response;
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

  async saveGeneratedPlaylist(input: {
    userId: string;
    sessionId: string;
    messageId: string;
    title?: string;
  }): Promise<SaveAiPlaylistResponseDto> {
    const assistantMessage = await this.prisma.chatMessage.findFirst({
      where: {
        id: input.messageId,
        role: ChatRole.ASSISTANT,
        chatSession: {
          id: input.sessionId,
          userId: input.userId,
          deletedAt: null,
        },
      },
      include: {
        chatSession: true,
      },
    });

    if (!assistantMessage) {
      throw new NotFoundException('AI DJ message was not found');
    }

    const existingPlaylists = await this.prisma.playlist.findMany({
      where: {
        userId: input.userId,
        playlistType: PlaylistType.AI_GENERATED,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    const existing = existingPlaylists.find((playlist) => {
      const metadata = this.readJsonObject(playlist.generatedContextJson);
      return metadata?.sourceMessageId === input.messageId;
    });

    if (existing) {
      return {
        created: false,
        playlist: {
          id: existing.id,
          title: existing.title,
          description: existing.description ?? '',
          playlistType: 'ai_generated',
          itemCount: existing._count.items,
        },
      };
    }

    const trace = this.readJsonObject(assistantMessage.traceJson);
    const intent = this.readIntentFromTrace(trace);
    if (intent !== 'theme_playlist_preview') {
      throw new BadRequestException(
        'Only theme playlist preview replies can be saved as playlists',
      );
    }

    const draft = this.readPlaylistDraftFromTrace(trace);
    const actionIds = this.extractActionContentIds(
      this.readActionsFromContentJson(assistantMessage.contentJson),
    );
    const contentIds = draft?.contentIds?.length ? draft.contentIds : actionIds;

    if (contentIds.length === 0) {
      throw new BadRequestException(
        'This AI DJ reply does not contain a savable playlist draft',
      );
    }

    const playlist = await this.libraryService.createAiGeneratedPlaylist(
      {
        title:
          input.title?.trim() ||
          draft?.title ||
          this.buildSavedPlaylistTitle(assistantMessage.chatSession.title),
        description:
          draft?.description ||
          'Generated from an AI DJ theme preview inside the current listening lane.',
        contentIds,
        generatedContext: {
          source: 'ai_dj',
          sourceSessionId: input.sessionId,
          sourceMessageId: input.messageId,
          intent,
        },
        reasonText: assistantMessage.contentText ?? undefined,
      },
      input.userId,
    );

    return {
      created: true,
      playlist,
    };
  }

  streamReply(input: {
    sessionId?: string;
    messageId: string;
    userId?: string;
  }): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const timers = new Set<ReturnType<typeof setTimeout>>();

      const queueEvent = (
        event:
          | AiDjStreamChunkEventDto
          | AiDjStreamActionsEventDto
          | AiDjStreamDoneEventDto,
        delayMs: number,
      ) => {
        const timer = setTimeout(() => {
          const { event: eventType, ...data } = event;
          subscriber.next({
            type: eventType,
            data,
          });
          timers.delete(timer);
        }, delayMs);
        timers.add(timer);
      };

      void this.resolveStreamPayload(input)
        .then((payload) => {
          const chunks = this.chunkReplyText(payload.replyText);
          chunks.forEach((delta, index) => {
            queueEvent(
              {
                event: 'chunk',
                sessionId: payload.sessionId,
                messageId: payload.messageId,
                delta,
              },
              index * 60,
            );
          });

          const lastDelay = chunks.length * 60;
          if (payload.actions.length > 0) {
            queueEvent(
              {
                event: 'actions',
                sessionId: payload.sessionId,
                messageId: payload.messageId,
                actions: payload.actions,
              },
              lastDelay + 40,
            );
          }

          const doneTimer = setTimeout(() => {
            subscriber.next({
              type: 'done',
              data: {
                sessionId: payload.sessionId,
                messageId: payload.messageId,
                replyText: payload.replyText,
                actions: payload.actions,
              },
            });
            this.streamPayloads.delete(payload.messageId);
            subscriber.complete();
            timers.delete(doneTimer);
          }, lastDelay + 100);
          timers.add(doneTimer);
        })
        .catch((error) => subscriber.error(error));

      return () => {
        for (const timer of timers) {
          clearTimeout(timer);
        }
      };
    });
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
        const playlistDraft = this.buildPlaylistDraft(message, picks);
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
            playlistDraft,
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
    const trace = this.readJsonObject(message.traceJson);
    return {
      id: message.id,
      role: message.role === ChatRole.USER ? 'user' : 'assistant',
      messageType:
        message.messageType === MessageType.ACTION ? 'action' : 'text',
      text: message.contentText ?? '',
      intent: this.readIntentFromTrace(trace),
      actions: this.readActionsFromContentJson(message.contentJson),
      createdAt: message.createdAt.toISOString(),
    };
  }

  private buildSessionTitle(message: string) {
    return message.trim().slice(0, 48);
  }

  private registerStreamPayload(payload: StreamPayload) {
    this.streamPayloads.set(payload.messageId, payload);
  }

  private buildPlaylistDraft(message: string, contentIds: string[]) {
    const cleaned = message
      .replace(/\s+/g, ' ')
      .replace(/[。！？!?]$/u, '')
      .trim();
    const subject = cleaned.slice(0, 32) || 'Current AI DJ signal';
    return {
      title: `${subject} - AI DJ`,
      description:
        'A reusable playlist captured from an AI DJ theme preview inside the current player lane.',
      contentIds,
    };
  }

  private buildSavedPlaylistTitle(sessionTitle?: string | null) {
    const base = sessionTitle?.trim();
    if (!base) {
      return 'AI DJ Theme Draft';
    }

    return `${base.slice(0, 32)} - AI DJ`;
  }

  private readIntentFromTrace(trace: Record<string, unknown> | null) {
    if (!trace) {
      return null;
    }

    const value = trace.intent;
    if (
      value === 'queue_replace' ||
      value === 'queue_append' ||
      value === 'recommend_explain' ||
      value === 'theme_playlist_preview'
    ) {
      return value;
    }

    return null;
  }

  private readPlaylistDraftFromTrace(trace: Record<string, unknown> | null) {
    const raw = trace?.playlistDraft;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }

    const data = raw as Record<string, unknown>;
    const contentIds = Array.isArray(data.contentIds)
      ? data.contentIds.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];

    return {
      title: typeof data.title === 'string' ? data.title : undefined,
      description:
        typeof data.description === 'string' ? data.description : undefined,
      contentIds,
    };
  }

  private readJsonObject(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private extractActionContentIds(actions: AiDjActionDto[]) {
    return [...new Set(actions.flatMap((action) => action.payload.contentIds))];
  }

  private async resolveStreamPayload(input: {
    sessionId?: string;
    messageId: string;
    userId?: string;
  }): Promise<StreamPayload> {
    const cached = this.streamPayloads.get(input.messageId);
    if (cached) {
      if (input.sessionId && cached.sessionId !== input.sessionId) {
        throw new NotFoundException('Stream payload was not found');
      }

      if (cached.userId && cached.userId !== input.userId) {
        throw new NotFoundException('Stream payload was not found');
      }

      return cached;
    }

    if (!input.userId) {
      throw new NotFoundException('Stream payload was not found');
    }

    const assistantMessage = await this.prisma.chatMessage.findFirst({
      where: {
        id: input.messageId,
        role: ChatRole.ASSISTANT,
        chatSession: {
          userId: input.userId,
          deletedAt: null,
          ...(input.sessionId ? { id: input.sessionId } : {}),
        },
      },
      include: {
        chatSession: true,
      },
    });

    if (!assistantMessage) {
      throw new NotFoundException('Stream payload was not found');
    }

    const payload: StreamPayload = {
      sessionId: assistantMessage.chatSessionId,
      messageId: assistantMessage.id,
      replyText: assistantMessage.contentText ?? '',
      actions: this.readActionsFromContentJson(assistantMessage.contentJson),
      userId: input.userId,
      createdAt: assistantMessage.createdAt.getTime(),
    };

    this.registerStreamPayload(payload);
    return payload;
  }

  private readActionsFromContentJson(json: Prisma.JsonValue | null) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      return [];
    }

    const actions = (json as { actions?: unknown }).actions;
    if (!Array.isArray(actions)) {
      return [];
    }

    return actions as AiDjActionDto[];
  }

  private chunkReplyText(replyText: string) {
    if (!replyText) {
      return [];
    }

    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < replyText.length) {
      const nextSlice = replyText.slice(cursor, cursor + 4);
      chunks.push(nextSlice);
      cursor += nextSlice.length;
    }

    return chunks;
  }

  private pruneAnonymousStreamPayloads() {
    const expiryMs = 5 * 60 * 1000;
    const now = Date.now();

    for (const [messageId, payload] of this.streamPayloads) {
      if (now - payload.createdAt > expiryMs) {
        this.streamPayloads.delete(messageId);
      }
    }
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
