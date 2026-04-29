import {
  BadRequestException,
  Injectable,
  MessageEvent,
  NotFoundException,
  Logger,
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
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { LibraryService } from '../../library/services/library.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationService } from '../../recommendation/services/recommendation.service';
import { IntentClassifierService } from './intent-classifier.service';
import { ContentSelectorService } from './content-selector.service';
import {
  ReplyGeneratorService,
  type ReplyContext,
} from './reply-generator.service';

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

type StreamPlan = {
  intent: ResolvedIntent;
  actions: AiDjActionDto[];
  contentIds: string[];
  trace: Record<string, unknown>;
  trackDescriptions: string;
  tasteSummary?: string;
  timeOfDay?: string;
  currentTrackTitle?: string;
  currentTrackLanguage?: string;
};

type StreamPayload = {
  sessionId: string;
  messageId: string;
  intent: ResolvedIntent;
  replyText: string;
  actions: AiDjActionDto[];
  userId?: string;
  createdAt: number;
  userMessage?: string;
  contentIds?: string[];
  trackDescriptions?: string;
  tasteSummary?: string;
  timeOfDay?: string;
  currentTrackTitle?: string;
  currentTrackLanguage?: string;
};

@Injectable()
export class AiDjService {
  private readonly logger = new Logger(AiDjService.name);
  private readonly streamPayloads = new Map<string, StreamPayload>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
    private readonly recommendationService: RecommendationService,
    private readonly libraryService: LibraryService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly contentSelector: ContentSelectorService,
    private readonly replyGenerator: ReplyGeneratorService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async reply(input: ReplyInput): Promise<ChatTurnResponseDto> {
    const message = input.message.trim();
    if (!message) {
      throw new BadRequestException('message is required');
    }
    this.pruneAnonymousStreamPayloads();

    const isStream = input.responseMode === 'stream';

    if (isStream) {
      return this.replyStreamMode(message, input);
    }

    return this.replySyncMode(message, input);
  }

  private async replySyncMode(
    message: string,
    input: ReplyInput,
  ): Promise<ChatTurnResponseDto> {
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

  private async replyStreamMode(
    message: string,
    input: ReplyInput,
  ): Promise<ChatTurnResponseDto> {
    const plan = await this.composeStreamPlan(
      message,
      input.surfaceContext,
      input.user?.id,
      input.timezoneHeader,
    );

    const knowledgeReplyText: string | undefined =
      plan.intent === 'knowledge_query' &&
      typeof plan.trace.knowledgeReplyText === 'string'
        ? plan.trace.knowledgeReplyText
        : undefined;

    const fallbackText =
      knowledgeReplyText ??
      this.replyGenerator.fallbackGenerate({
        message,
        intent: plan.intent,
        contentIds: plan.contentIds,
        trackDescriptions: plan.trackDescriptions,
        tasteProfileSummary: plan.tasteSummary,
        timeOfDay: plan.timeOfDay,
        currentTrackTitle: plan.currentTrackTitle,
        currentTrackLanguage: plan.currentTrackLanguage,
      });

    if (!input.user?.id) {
      const response = {
        sessionId: input.sessionId ?? this.createAnonymousSessionId(),
        messageId: this.createAnonymousMessageId(),
        intent: plan.intent,
        replyText: fallbackText,
        actions: plan.actions,
      };
      this.registerStreamPayload({
        ...response,
        createdAt: Date.now(),
        userMessage: message,
        contentIds: plan.contentIds,
        trackDescriptions: plan.trackDescriptions,
        tasteSummary: plan.tasteSummary,
        timeOfDay: plan.timeOfDay,
        currentTrackTitle: plan.currentTrackTitle,
        currentTrackLanguage: plan.currentTrackLanguage,
      });
      return response;
    }

    const trace = {
      ...plan.trace,
      streamPhase: 1,
      contentIds: plan.contentIds,
      trackDescriptions: plan.trackDescriptions,
      tasteSummary: plan.tasteSummary,
      timeOfDay: plan.timeOfDay,
      currentTrackTitle: plan.currentTrackTitle,
      currentTrackLanguage: plan.currentTrackLanguage,
      userMessage: message,
      surfaceContext: input.surfaceContext ?? {},
    };

    const persisted = await this.persistTurn({
      userId: input.user.id,
      sessionId: input.sessionId,
      userMessage: message,
      assistantReply: '',
      assistantActions: plan.actions,
      trace,
      timezoneHeader: input.timezoneHeader,
    });

    const response = {
      sessionId: persisted.sessionId,
      messageId: persisted.messageId,
      intent: plan.intent,
      replyText: fallbackText,
      actions: plan.actions,
    };

    this.registerStreamPayload({
      ...response,
      userId: input.user.id,
      createdAt: Date.now(),
      userMessage: message,
      contentIds: plan.contentIds,
      trackDescriptions: plan.trackDescriptions,
      tasteSummary: plan.tasteSummary,
      timeOfDay: plan.timeOfDay,
      currentTrackTitle: plan.currentTrackTitle,
      currentTrackLanguage: plan.currentTrackLanguage,
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
      const abortController = new AbortController();

      void this.executeStreamReply(
        input,
        subscriber,
        abortController.signal,
      ).catch((error) => subscriber.error(error));

      return () => {
        abortController.abort();
      };
    });
  }

  private async executeStreamReply(
    input: {
      sessionId?: string;
      messageId: string;
      userId?: string;
    },
    subscriber: {
      next: (event: MessageEvent) => void;
      complete: () => void;
    },
    signal: AbortSignal,
  ): Promise<void> {
    const payload = await this.resolveStreamPayload(input);
    const sessionId = payload.sessionId;
    const messageId = payload.messageId;

    const streamContext = await this.buildStreamContext(
      input.messageId,
      input.userId,
    );

    // Use cached payload as fallback context for anonymous users
    const replyContext: ReplyContext | null = streamContext
      ? {
          message: streamContext.userMessage,
          intent: streamContext.intent,
          contentIds: streamContext.contentIds,
          trackDescriptions: streamContext.trackDescriptions,
          tasteProfileSummary: streamContext.tasteSummary,
          timeOfDay: streamContext.timeOfDay,
          currentTrackTitle: streamContext.currentTrackTitle,
          currentTrackLanguage: streamContext.currentTrackLanguage,
        }
      : payload.userMessage
        ? {
            message: payload.userMessage,
            intent: payload.intent,
            contentIds:
              payload.contentIds ??
              payload.actions.flatMap((a) => a.payload.contentIds),
            trackDescriptions: payload.trackDescriptions ?? '',
            tasteProfileSummary: payload.tasteSummary,
            timeOfDay: payload.timeOfDay,
            currentTrackTitle: payload.currentTrackTitle,
            currentTrackLanguage: payload.currentTrackLanguage,
          }
        : null;

    if (replyContext) {
      // For knowledge_query with pre-generated reply, stream the cached text
      const isKnowledgeWithCache =
        replyContext.intent === 'knowledge_query' &&
        streamContext?.knowledgeReplyText;

      let fullText = '';

      if (isKnowledgeWithCache) {
        fullText = streamContext.knowledgeReplyText!;
        const chars = this.chunkReplyText(fullText);
        for (const char of chars) {
          if (signal.aborted) {
            return;
          }
          subscriber.next({
            type: 'chunk',
            data: {
              sessionId,
              messageId,
              delta: char,
            },
          });
        }
        this.logger.log(
          `Streamed pre-generated knowledge reply for message ${messageId}`,
        );
      } else {
        this.logger.log(
          `Streaming LLM reply for message ${messageId} (${streamContext ? 'db' : 'cached'} context)`,
        );

        try {
          fullText = await this.replyGenerator.generateStreamReply(
            replyContext,
            (delta) => {
              subscriber.next({
                type: 'chunk',
                data: {
                  sessionId,
                  messageId,
                  delta,
                },
              });
            },
            signal,
          );
        } catch (error) {
          this.logger.warn(
            `LLM streaming failed, using fallback: ${String(error)}`,
          );

          if (signal.aborted) {
            return;
          }

          fullText = this.replyGenerator.fallbackGenerate(replyContext);
          const chars = this.chunkReplyText(fullText);
          for (const char of chars) {
            if (signal.aborted) {
              return;
            }
            subscriber.next({
              type: 'chunk',
              data: {
                sessionId,
                messageId,
                delta: char,
              },
            });
          }
        }
      }

      if (signal.aborted) {
        return;
      }

      if (payload.actions.length > 0) {
        subscriber.next({
          type: 'actions',
          data: {
            sessionId,
            messageId,
            actions: payload.actions,
          },
        });
      }

      subscriber.next({
        type: 'done',
        data: {
          sessionId,
          messageId,
          replyText: fullText,
          actions: payload.actions,
          intent: replyContext.intent,
        },
      });

      await this.updatePersistedReply(messageId, fullText);

      this.streamPayloads.delete(messageId);
      subscriber.complete();
    } else {
      let replyText = payload.replyText;

      if (!replyText) {
        this.logger.log(
          `No replyText in stream payload for ${messageId}, generating fallback`,
        );
        const contentIds = payload.actions.flatMap(
          (action) => action.payload.contentIds,
        );
        replyText = this.replyGenerator.fallbackGenerate({
          message: '',
          intent: payload.intent,
          contentIds,
          trackDescriptions: '',
        });
      }

      const chunks = this.chunkReplyText(replyText);

      for (const delta of chunks) {
        if (signal.aborted) {
          return;
        }
        subscriber.next({
          type: 'chunk',
          data: {
            sessionId,
            messageId,
            delta,
          },
        });

        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 60);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });

        if (signal.aborted) {
          return;
        }
      }

      if (payload.actions.length > 0) {
        subscriber.next({
          type: 'actions',
          data: {
            sessionId,
            messageId,
            actions: payload.actions,
          },
        });
      }

      subscriber.next({
        type: 'done',
        data: {
          sessionId,
          messageId,
          replyText,
          actions: payload.actions,
          intent: payload.intent,
        },
      });

      this.streamPayloads.delete(messageId);
      subscriber.complete();
    }
  }

  private async buildStreamContext(
    messageId: string,
    userId?: string,
  ): Promise<{
    userMessage: string;
    intent: AiDjIntent;
    contentIds: string[];
    trackDescriptions: string;
    tasteSummary?: string;
    timeOfDay?: string;
    currentTrackTitle?: string;
    currentTrackLanguage?: string;
    knowledgeReplyText?: string;
  } | null> {
    if (!userId) {
      return null;
    }

    const message = await this.prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        role: ChatRole.ASSISTANT,
        chatSession: {
          userId,
          deletedAt: null,
        },
      },
    });

    if (!message) {
      return null;
    }

    const trace = this.readJsonObject(message.traceJson);
    if (!trace) {
      return null;
    }

    const userMessage =
      typeof trace.userMessage === 'string' ? trace.userMessage : '';
    const intent = this.readIntentFromTrace(trace);
    const contentIds = Array.isArray(trace.contentIds)
      ? trace.contentIds.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    const trackDescriptions =
      typeof trace.trackDescriptions === 'string'
        ? trace.trackDescriptions
        : '';
    const tasteSummary =
      typeof trace.tasteSummary === 'string' ? trace.tasteSummary : undefined;
    const timeOfDay =
      typeof trace.timeOfDay === 'string' ? trace.timeOfDay : undefined;
    const currentTrackTitle =
      typeof trace.currentTrackTitle === 'string'
        ? trace.currentTrackTitle
        : undefined;
    const currentTrackLanguage =
      typeof trace.currentTrackLanguage === 'string'
        ? trace.currentTrackLanguage
        : undefined;
    const knowledgeReplyText =
      typeof trace.knowledgeReplyText === 'string'
        ? trace.knowledgeReplyText
        : undefined;

    if (!intent || !userMessage) {
      return null;
    }

    return {
      userMessage,
      intent,
      contentIds,
      trackDescriptions,
      tasteSummary,
      timeOfDay,
      currentTrackTitle,
      currentTrackLanguage,
      knowledgeReplyText,
    };
  }

  private async updatePersistedReply(
    messageId: string,
    fullText: string,
  ): Promise<void> {
    try {
      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: { contentText: fullText },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update persisted reply for ${messageId}: ${String(error)}`,
      );
    }
  }

  private async composeReplyPlan(
    message: string,
    surfaceContext: ChatSurfaceContextDto | undefined,
    userId?: string,
    timezoneHeader?: string,
  ): Promise<ReplyPlan> {
    const intent = await this.intentClassifier.classify(message);

    if (intent === 'knowledge_query') {
      if (userId) {
        try {
          const result = await this.knowledgeService.query(
            userId,
            null,
            message,
          );
          return {
            intent,
            replyText: result.summaryText,
            actions: [],
            trace: {
              intent,
              knowledgeTraceId: result.traceId,
              relatedContentIds: result.relatedContent.map((c) => c.contentId),
              mode: 'knowledge_query_v1',
            },
          };
        } catch (error) {
          this.logger.warn(
            `Knowledge query failed, using conversational fallback: ${String(error)}`,
          );
        }
      }

      // Fallback to conversation-style reply
      const fallbackText = await this.replyGenerator.generateReply({
        message,
        intent,
        contentIds: [],
        trackDescriptions: '',
      });
      return {
        intent,
        replyText: fallbackText,
        actions: [],
        trace: { intent, fallback: true, mode: 'knowledge_query_fallback_v1' },
      };
    }

    const isConversation = intent === 'conversation';
    const queueIds = surfaceContext?.queueContentIds ?? [];

    let picks: string[] = [];
    let trackDescriptions = '';
    let actions: AiDjActionDto[] = [];

    if (!isConversation) {
      const count =
        intent === 'queue_append'
          ? 2
          : intent === 'theme_playlist_preview'
            ? 3
            : 3;
      const contentIds = await this.contentSelector.selectContent(
        message,
        count,
      );

      const filtered =
        intent === 'queue_append'
          ? contentIds.filter((id) => !queueIds.includes(id))
          : contentIds;

      picks = filtered.slice(0, intent === 'queue_append' ? 2 : 3);

      actions =
        picks.length > 0
          ? [
              {
                type:
                  intent === 'queue_append' ? 'queue_append' : 'queue_replace',
                payload: { contentIds: picks },
              },
            ]
          : [];

      const trackItems = await this.contentService.getByIds(picks);
      trackDescriptions = trackItems
        .map(
          (t) =>
            `"${t.title}" by ${(t.artists ?? []).join(', ')} [${t.language ?? 'en'}, ${t.type}]`,
        )
        .join('\n');
    }

    const currentTrackTitle = surfaceContext?.currentTrackId
      ? ((await this.contentService.getById(surfaceContext.currentTrackId))
          ?.title ?? undefined)
      : undefined;

    const currentTrack = surfaceContext?.currentTrackId
      ? await this.contentService.getById(surfaceContext.currentTrackId)
      : null;

    let tasteSummary: string | undefined;
    let timeOfDay: string | undefined;

    if (userId) {
      try {
        const recommendation =
          await this.recommendationService.getNowRecommendation(
            userId,
            timezoneHeader,
          );
        tasteSummary = recommendation.explanation;

        const hour = new Date().getHours();
        timeOfDay =
          hour < 6
            ? 'late-night'
            : hour < 11
              ? 'morning'
              : hour < 17
                ? 'daytime'
                : hour < 21
                  ? 'evening'
                  : 'late-night';
      } catch {
        // Non-critical — reply still works without taste context
      }
    }

    const replyContext: ReplyContext = {
      message,
      intent,
      contentIds: picks,
      trackDescriptions,
      tasteProfileSummary: tasteSummary,
      timeOfDay,
      currentTrackTitle,
      currentTrackLanguage: currentTrack?.language ?? undefined,
    };

    const replyText = await this.replyGenerator.generateReply(replyContext);

    return {
      intent,
      replyText,
      actions,
      trace: {
        intent,
        matchedContentIds: picks,
        mode: 'llm_v1',
        ...(intent === 'theme_playlist_preview'
          ? {
              playlistDraft: this.buildPlaylistDraft(message, picks),
            }
          : {}),
      },
    };
  }

  private async composeStreamPlan(
    message: string,
    surfaceContext: ChatSurfaceContextDto | undefined,
    userId?: string,
    timezoneHeader?: string,
  ): Promise<StreamPlan> {
    const intent = await this.intentClassifier.classify(message);

    if (intent === 'knowledge_query') {
      if (userId) {
        try {
          const result = await this.knowledgeService.query(
            userId,
            null,
            message,
          );
          return {
            intent,
            actions: [],
            contentIds: result.relatedContent.map((c) => c.contentId),
            trackDescriptions: '',
            trace: {
              intent,
              knowledgeTraceId: result.traceId,
              knowledgeReplyText: result.summaryText,
              relatedContentIds: result.relatedContent.map((c) => c.contentId),
              mode: 'knowledge_query_stream_v1',
            },
          };
        } catch (error) {
          this.logger.warn(
            `Knowledge query (stream) failed, using conversational fallback: ${String(error)}`,
          );
        }
      }

      // Fallback to conversation-style stream
      return {
        intent,
        actions: [],
        contentIds: [],
        trackDescriptions: '',
        trace: {
          intent,
          fallback: true,
          mode: 'knowledge_query_stream_fallback_v1',
        },
      };
    }

    const isConversation = intent === 'conversation';
    const queueIds = surfaceContext?.queueContentIds ?? [];

    let picks: string[] = [];
    let trackDescriptions = '';
    let actions: AiDjActionDto[] = [];

    if (!isConversation) {
      const count =
        intent === 'queue_append'
          ? 2
          : intent === 'theme_playlist_preview'
            ? 3
            : 3;
      const contentIds = await this.contentSelector.selectContent(
        message,
        count,
      );

      const filtered =
        intent === 'queue_append'
          ? contentIds.filter((id) => !queueIds.includes(id))
          : contentIds;

      picks = filtered.slice(0, intent === 'queue_append' ? 2 : 3);

      actions =
        picks.length > 0
          ? [
              {
                type:
                  intent === 'queue_append' ? 'queue_append' : 'queue_replace',
                payload: { contentIds: picks },
              },
            ]
          : [];

      const trackItems = await this.contentService.getByIds(picks);
      trackDescriptions = trackItems
        .map(
          (t) =>
            `"${t.title}" by ${(t.artists ?? []).join(', ')} [${t.language ?? 'en'}, ${t.type}]`,
        )
        .join('\n');
    }

    const currentTrack = surfaceContext?.currentTrackId
      ? await this.contentService.getById(surfaceContext.currentTrackId)
      : null;

    let tasteSummary: string | undefined;
    let timeOfDay: string | undefined;

    if (userId) {
      try {
        const recommendation =
          await this.recommendationService.getNowRecommendation(
            userId,
            timezoneHeader,
          );
        tasteSummary = recommendation.explanation;

        const hour = new Date().getHours();
        timeOfDay =
          hour < 6
            ? 'late-night'
            : hour < 11
              ? 'morning'
              : hour < 17
                ? 'daytime'
                : hour < 21
                  ? 'evening'
                  : 'late-night';
      } catch {
        // Non-critical
      }
    }

    return {
      intent,
      actions,
      contentIds: picks,
      trackDescriptions,
      tasteSummary,
      timeOfDay,
      currentTrackTitle: currentTrack?.title ?? undefined,
      currentTrackLanguage: currentTrack?.language ?? undefined,
      trace: {
        intent,
        matchedContentIds: picks,
        mode: 'llm_stream_v1',
        ...(intent === 'theme_playlist_preview' && picks.length > 0
          ? {
              playlistDraft: this.buildPlaylistDraft(message, picks),
            }
          : {}),
      },
    };
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
      value === 'conversation' ||
      value === 'queue_replace' ||
      value === 'queue_append' ||
      value === 'recommend_explain' ||
      value === 'theme_playlist_preview' ||
      value === 'knowledge_query'
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

    const trace = this.readJsonObject(assistantMessage.traceJson);
    const intent = this.readIntentFromTrace(trace) ?? 'conversation';

    const payload: StreamPayload = {
      sessionId: assistantMessage.chatSessionId,
      messageId: assistantMessage.id,
      intent,
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
