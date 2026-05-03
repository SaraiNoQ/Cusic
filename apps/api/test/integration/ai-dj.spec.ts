import { AiDjController } from '../../src/modules/ai-dj/controllers/ai-dj.controller';
import type { AiDjService } from '../../src/modules/ai-dj/services/ai-dj.service';
import { AiDjService as AiDjServiceClass } from '../../src/modules/ai-dj/services/ai-dj.service';
import { IntentClassifierService } from '../../src/modules/ai-dj/services/intent-classifier.service';
import type { ContentService } from '../../src/modules/content/services/content.service';
import type { RecommendationService } from '../../src/modules/recommendation/services/recommendation.service';
import type { LibraryService } from '../../src/modules/library/services/library.service';
import type { PrismaService } from '../../src/modules/prisma/prisma.service';
import type { ContentSelectorService } from '../../src/modules/ai-dj/services/content-selector.service';
import type { ReplyGeneratorService } from '../../src/modules/ai-dj/services/reply-generator.service';
import type { KnowledgeService } from '../../src/modules/knowledge/knowledge.service';
import type { LlmService } from '../../src/modules/llm/services/llm.service';
import type { VoiceService } from '../../src/modules/voice/voice.service';
import type {
  ChatTurnResponseDto,
  AiDjIntent,
  ContentItemDto,
} from '@music-ai/shared';
import type { RequestWithUser } from '../../src/modules/auth/guards/jwt-auth.guard';
import type { MessageEvent } from '@nestjs/common';

function mockChatReply(
  overrides: Partial<ChatTurnResponseDto> = {},
): ChatTurnResponseDto {
  return {
    sessionId: 'ses_test_1',
    messageId: 'msg_test_1',
    intent: 'conversation' as AiDjIntent,
    replyText: 'Hello! How can I help with your music today?',
    actions: [],
    ...overrides,
  };
}

describe('AiDjController (integration)', () => {
  let controller: AiDjController;
  let mockAiDjService: Record<string, jest.Mock>;
  let mockVoiceService: Record<string, jest.Mock>;

  const anonymousRequest: RequestWithUser = {
    headers: {},
    user: undefined,
  };

  const authenticatedRequest: RequestWithUser = {
    headers: { authorization: 'Bearer test-token' },
    user: { id: 'user_1', email: 'a@b.com', sessionId: 'ses_1' },
  };

  beforeEach(() => {
    mockAiDjService = {
      reply: jest.fn(),
      getSessionMessages: jest.fn(),
      saveGeneratedPlaylist: jest.fn(),
      streamReply: jest.fn(),
    };
    mockVoiceService = {
      transcribe: jest.fn(),
      synthesize: jest.fn(),
    };
    controller = new AiDjController(
      mockAiDjService as unknown as AiDjService,
      mockVoiceService as unknown as VoiceService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /dj/chat ─────────────────────────────────────────────────
  describe('chat()', () => {
    it('returns a reply with replyText for a valid message', async () => {
      const reply = mockChatReply();
      mockAiDjService.reply!.mockResolvedValue(reply);

      const result = await controller.chat(
        {
          message: 'Play something relaxing',
          responseMode: 'sync',
        },
        authenticatedRequest,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('replyText');
      expect(result.data.replyText).toBe(
        'Hello! How can I help with your music today?',
      );
      expect(result.data).toHaveProperty('sessionId');
      expect(result.data).toHaveProperty('intent');
      expect(result.data.actions).toEqual([]);
    });

    it('forwards user, message, and responseMode to the service', async () => {
      mockAiDjService.reply!.mockResolvedValue(mockChatReply());

      await controller.chat(
        {
          message: 'Give me Cantopop',
          responseMode: 'sync',
          sessionId: 'ses_existing',
        },
        authenticatedRequest,
      );

      expect(mockAiDjService.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Give me Cantopop',
          responseMode: 'sync',
          sessionId: 'ses_existing',
          user: authenticatedRequest.user,
        }),
      );
    });

    it('accepts anonymous users (no auth required)', async () => {
      mockAiDjService.reply!.mockResolvedValue(
        mockChatReply({ replyText: 'Playing something for you as a guest.' }),
      );

      const result = await controller.chat(
        {
          message: 'Hey DJ',
          responseMode: 'sync',
        },
        anonymousRequest,
      );

      expect(result.success).toBe(true);
      expect(result.data.replyText).toBe(
        'Playing something for you as a guest.',
      );
      expect(mockAiDjService.reply).toHaveBeenCalledWith(
        expect.objectContaining({ user: undefined }),
      );
    });

    it('passes timezone header to the service', async () => {
      mockAiDjService.reply!.mockResolvedValue(mockChatReply());

      await controller.chat(
        { message: 'Good morning', responseMode: 'sync' },
        authenticatedRequest,
        'Asia/Shanghai',
      );

      expect(mockAiDjService.reply).toHaveBeenCalledWith(
        expect.objectContaining({ timezoneHeader: 'Asia/Shanghai' }),
      );
    });

    it('forwards surfaceContext when provided', async () => {
      mockAiDjService.reply!.mockResolvedValue(mockChatReply());

      await controller.chat(
        {
          message: 'Add more like this',
          responseMode: 'sync',
          surfaceContext: {
            currentTrackId: 'cnt_test_1',
            queueContentIds: ['cnt_a', 'cnt_b'],
          },
        },
        authenticatedRequest,
      );

      expect(mockAiDjService.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          surfaceContext: {
            currentTrackId: 'cnt_test_1',
            queueContentIds: ['cnt_a', 'cnt_b'],
          },
        }),
      );
    });
  });
});

describe('IntentClassifierService', () => {
  const llmService = {
    isAvailable: jest.fn().mockResolvedValue(false),
  } as unknown as LlmService;
  const classifier = new IntentClassifierService(llmService);

  it.each([
    ['来一首爵士', 'queue_replace'],
    ['放一首粤语', 'queue_replace'],
    ['给我来点摇滚', 'queue_replace'],
    ['再来一首', 'queue_append'],
    ['做个夜晚歌单', 'theme_playlist_preview'],
    ['介绍一下爵士历史', 'knowledge_query'],
  ] satisfies Array<[string, AiDjIntent]>)(
    'classifies %s as %s',
    async (message, intent) => {
      await expect(classifier.classify(message)).resolves.toBe(intent);
    },
  );
});

describe('AiDjService tool planner', () => {
  const jazzTrack: ContentItemDto = {
    id: 'cnt_jazz_1',
    type: 'track',
    title: 'Blue Hour',
    artists: ['Night Trio'],
    album: 'After Dark',
    durationMs: 180000,
    language: 'instrumental',
    coverUrl: null,
    audioUrl: 'https://example.com/blue-hour.mp3',
    playable: true,
  };
  const rockTrack: ContentItemDto = {
    ...jazzTrack,
    id: 'cnt_rock_1',
    title: 'Wire Guitar',
  };

  function createService(overrides: {
    intent?: AiDjIntent;
    selectedIds?: string[];
  }) {
    const contentById = new Map([
      [jazzTrack.id, jazzTrack],
      [rockTrack.id, rockTrack],
    ]);
    const prisma = {} as PrismaService;
    const contentService = {
      getByIds: jest.fn(async (ids: string[]) =>
        ids
          .map((id) => contentById.get(id))
          .filter((item): item is ContentItemDto => Boolean(item)),
      ),
      getById: jest.fn().mockResolvedValue(null),
    } as unknown as ContentService;
    const recommendationService = {} as RecommendationService;
    const libraryService = {} as LibraryService;
    const intentClassifier = {
      classify: jest
        .fn()
        .mockResolvedValue(overrides.intent ?? 'queue_replace'),
    } as unknown as IntentClassifierService;
    const contentSelector = {
      selectContent: jest
        .fn()
        .mockResolvedValue(overrides.selectedIds ?? [jazzTrack.id]),
    } as unknown as ContentSelectorService;
    const replyGenerator = {
      generateReply: jest.fn(async () => '已切换到 Blue Hour。'),
      generateStreamReply: jest.fn(
        async (
          _context: unknown,
          onChunk: (delta: string) => void,
        ): Promise<string> => {
          onChunk('已切换');
          return '已切换到 Blue Hour。';
        },
      ),
      fallbackGenerate: jest.fn(() => '没有找到可播放的匹配曲目。'),
    } as unknown as ReplyGeneratorService;
    const knowledgeService = {} as KnowledgeService;

    const service = new AiDjServiceClass(
      prisma,
      contentService,
      recommendationService,
      libraryService,
      intentClassifier,
      contentSelector,
      replyGenerator,
      knowledgeService,
    );

    return { service, contentSelector, replyGenerator };
  }

  it('returns a queue_replace action for a playback command', async () => {
    const { service, contentSelector } = createService({
      intent: 'queue_replace',
      selectedIds: [jazzTrack.id],
    });

    const response = await service.reply({
      message: '来一首爵士',
      responseMode: 'sync',
    });

    expect(contentSelector.selectContent).toHaveBeenCalledWith('来一首爵士', 1);
    expect(response.intent).toBe('queue_replace');
    expect(response.actions).toEqual([
      {
        type: 'queue_replace',
        payload: { contentIds: [jazzTrack.id] },
      },
    ]);
  });

  it('returns queue_append and filters tracks already in the queue', async () => {
    const { service } = createService({
      intent: 'queue_append',
      selectedIds: [jazzTrack.id, rockTrack.id],
    });

    const response = await service.reply({
      message: '再来一首',
      responseMode: 'sync',
      surfaceContext: {
        currentTrackId: jazzTrack.id,
        queueContentIds: [jazzTrack.id],
      },
    });

    expect(response.intent).toBe('queue_append');
    expect(response.actions).toEqual([
      {
        type: 'queue_append',
        payload: { contentIds: [rockTrack.id] },
      },
    ]);
  });

  it('does not fabricate an action when no playable content is selected', async () => {
    const { service } = createService({
      intent: 'queue_replace',
      selectedIds: [],
    });

    const response = await service.reply({
      message: '来一首不存在的风格',
      responseMode: 'sync',
    });

    expect(response.intent).toBe('queue_replace');
    expect(response.actions).toEqual([]);
    expect(response.replyText).toContain('没有找到可播放');
  });

  it('keeps POST and stream actions aligned', async () => {
    const { service } = createService({
      intent: 'queue_replace',
      selectedIds: [jazzTrack.id],
    });

    const response = await service.reply({
      message: '来一首爵士',
      responseMode: 'stream',
    });

    const events = await new Promise<MessageEvent[]>((resolve, reject) => {
      const collected: MessageEvent[] = [];
      service
        .streamReply({
          sessionId: response.sessionId,
          messageId: response.messageId,
        })
        .subscribe({
          next: (event) => collected.push(event),
          error: reject,
          complete: () => resolve(collected),
        });
    });
    const done = events.find((event) => event.type === 'done');

    expect(response.actions).toEqual([
      {
        type: 'queue_replace',
        payload: { contentIds: [jazzTrack.id] },
      },
    ]);
    expect(done?.data).toEqual(
      expect.objectContaining({
        intent: 'queue_replace',
        actions: response.actions,
      }),
    );
  });
});
