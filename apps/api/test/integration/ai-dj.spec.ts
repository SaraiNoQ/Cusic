import { AiDjController } from '../../src/modules/ai-dj/controllers/ai-dj.controller';
import type { AiDjService } from '../../src/modules/ai-dj/services/ai-dj.service';
import type { VoiceService } from '../../src/modules/voice/voice.service';
import type { ChatTurnResponseDto, AiDjIntent } from '@music-ai/shared';
import type { RequestWithUser } from '../../src/modules/auth/guards/jwt-auth.guard';

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
