import { EventsController } from '../../src/modules/events/controllers/events.controller';
import type { EventsService } from '../../src/modules/events/services/events.service';
import type { PlayerQueueStateDto, ContentItemDto } from '@music-ai/shared';
import type { RequestWithUser } from '../../src/modules/auth/guards/jwt-auth.guard';

function mockTrack(overrides: Partial<ContentItemDto> = {}): ContentItemDto {
  return {
    id: 'cnt_test_1',
    type: 'track',
    title: 'Test Track',
    artists: ['Test Artist'],
    album: null,
    durationMs: 200000,
    language: 'en',
    coverUrl: null,
    audioUrl: null,
    playable: true,
    ...overrides,
  };
}

function mockQueueState(
  overrides: Partial<PlayerQueueStateDto> = {},
): PlayerQueueStateDto {
  return {
    queueId: 'queue_demo',
    count: 2,
    items: [mockTrack({ id: 'cnt_a' }), mockTrack({ id: 'cnt_b' })],
    activeIndex: 0,
    currentTrack: mockTrack({ id: 'cnt_a' }),
    positionMs: 0,
    ...overrides,
  };
}

describe('EventsController (integration)', () => {
  let controller: EventsController;
  let mockService: Record<string, jest.Mock>;

  const mockRequest: RequestWithUser = {
    headers: {},
    user: undefined,
  };

  beforeEach(() => {
    mockService = {
      getQueue: jest.fn(),
      updateQueue: jest.fn(),
      recordPlaybackEvent: jest.fn(),
    };
    controller = new EventsController(mockService as unknown as EventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /player/queue ─────────────────────────────────────────────
  describe('getQueue()', () => {
    it('returns queue state envelope', async () => {
      mockService.getQueue!.mockResolvedValue(mockQueueState());

      const result = await controller.getQueue(mockRequest);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('queueId');
      expect(result.data).toHaveProperty('items');
      expect(result.data).toHaveProperty('activeIndex');
      expect(result.data).toHaveProperty('currentTrack');
      expect(result.data.count).toBe(2);
      expect(result.data.items).toHaveLength(2);
    });

    it('passes userId to service when user is authenticated', async () => {
      const authRequest: RequestWithUser = {
        headers: { authorization: 'Bearer test-token' },
        user: { id: 'user_1', email: 'a@b.com', sessionId: 'ses_1' },
      };
      mockService.getQueue!.mockResolvedValue(mockQueueState());

      await controller.getQueue(authRequest);

      expect(mockService.getQueue).toHaveBeenCalledWith('user_1');
    });

    it('passes undefined to service for anonymous requests', async () => {
      mockService.getQueue!.mockResolvedValue(mockQueueState());

      await controller.getQueue(mockRequest);

      expect(mockService.getQueue).toHaveBeenCalledWith(undefined);
    });
  });

  // ── POST /player/queue ────────────────────────────────────────────
  describe('updateQueue()', () => {
    it('passes replace queue payload and user state to the service', async () => {
      const authRequest: RequestWithUser = {
        headers: { authorization: 'Bearer test-token' },
        user: { id: 'user_1', email: 'a@b.com', sessionId: 'ses_1' },
      };
      mockService.updateQueue!.mockResolvedValue(
        mockQueueState({
          activeIndex: 1,
          currentTrack: mockTrack({ id: 'cnt_b' }),
        }),
      );

      const result = await controller.updateQueue(
        {
          mode: 'replace',
          items: [{ contentId: 'cnt_a' }, { contentId: 'cnt_b' }],
          activeIndex: 1,
          currentContentId: 'cnt_b',
          positionMs: 45000,
        },
        authRequest,
      );

      expect(result.success).toBe(true);
      expect(result.data.activeIndex).toBe(1);
      expect(mockService.updateQueue).toHaveBeenCalledWith(
        'replace',
        [{ contentId: 'cnt_a' }, { contentId: 'cnt_b' }],
        {
          activeIndex: 1,
          currentContentId: 'cnt_b',
          positionMs: 45000,
        },
        'user_1',
      );
    });
  });

  // ── POST /player/events ───────────────────────────────────────────
  describe('recordPlaybackEvent()', () => {
    it('accepts a playback event and returns accepted envelope', async () => {
      mockService.recordPlaybackEvent!.mockResolvedValue({
        accepted: true,
        eventType: 'PLAY_STARTED',
        totalEvents: 1,
      });

      const result = await controller.recordPlaybackEvent(
        {
          contentId: 'cnt_test_1',
          eventType: 'PLAY_STARTED',
          positionMs: 0,
          occurredAt: new Date().toISOString(),
        },
        mockRequest,
      );

      expect(result.success).toBe(true);
      expect(result.data.accepted).toBe(true);
      expect(result.data.eventType).toBe('PLAY_STARTED');
      expect(mockService.recordPlaybackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          contentId: 'cnt_test_1',
          eventType: 'PLAY_STARTED',
        }),
        undefined,
      );
    });

    it('passes event details through to the service', async () => {
      mockService.recordPlaybackEvent!.mockResolvedValue({
        accepted: true,
        eventType: 'SKIPPED',
        totalEvents: 5,
      });

      const timestamp = new Date().toISOString();
      await controller.recordPlaybackEvent(
        {
          contentId: 'cnt_b',
          eventType: 'SKIPPED',
          positionMs: 30000,
          occurredAt: timestamp,
        },
        mockRequest,
      );

      expect(mockService.recordPlaybackEvent).toHaveBeenCalledWith(
        {
          contentId: 'cnt_b',
          eventType: 'SKIPPED',
          positionMs: 30000,
          occurredAt: timestamp,
        },
        undefined,
      );
    });
  });
});
