import { RecommendationController } from '../../src/modules/recommendation/controllers/recommendation.controller';
import { RecommendationService } from '../../src/modules/recommendation/services/recommendation.service';
import type { ContentService } from '../../src/modules/content/services/content.service';
import type { PrismaService } from '../../src/modules/prisma/prisma.service';
import type { ProfileService } from '../../src/modules/profile/services/profile.service';
import type { LlmService } from '../../src/modules/llm/services/llm.service';
import type { ContextService } from '../../src/modules/context/context.service';
import type { VectorSearchService } from '../../src/modules/prisma/vector-search.service';
import type { EmbeddingService } from '../../src/modules/content/services/embedding.service';
import type { NowRecommendationDto, ContentItemDto } from '@music-ai/shared';
import type { RequestWithUser } from '../../src/modules/auth/guards/jwt-auth.guard';
import { ContentType } from '@prisma/client';

function mockContentItem(
  overrides: Partial<ContentItemDto> = {},
): ContentItemDto {
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

function mockNowRecommendation(
  overrides: Partial<NowRecommendationDto> = {},
): NowRecommendationDto {
  return {
    recommendationId: 'rec_test_1',
    explanation: 'A balanced lane for your current session.',
    items: [
      {
        contentId: 'cnt_1',
        title: 'Track One',
        reason: 'Fits your current mood.',
        content: mockContentItem({ id: 'cnt_1', title: 'Track One' }),
      },
      {
        contentId: 'cnt_2',
        title: 'Track Two',
        reason: 'Matches recent listening.',
        content: mockContentItem({ id: 'cnt_2', title: 'Track Two' }),
      },
    ],
    ...overrides,
  };
}

describe('RecommendationController (integration)', () => {
  let controller: RecommendationController;
  let mockService: Record<string, jest.Mock>;

  const anonymousRequest: RequestWithUser = {
    headers: {},
    user: undefined,
  };

  beforeEach(() => {
    mockService = {
      getNowRecommendation: jest.fn(),
      getDailyPlaylist: jest.fn(),
      submitFeedback: jest.fn(),
    };
    controller = new RecommendationController(
      mockService as unknown as RecommendationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /recommend/now ────────────────────────────────────────────
  describe('getNowRecommendation()', () => {
    it('returns recommendation cards with content items', async () => {
      mockService.getNowRecommendation!.mockResolvedValue(
        mockNowRecommendation(),
      );

      const result = await controller.getNowRecommendation(anonymousRequest);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('recommendationId');
      expect(result.data).toHaveProperty('explanation');
      expect(result.data).toHaveProperty('items');
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0]).toHaveProperty('contentId');
      expect(result.data.items[0]).toHaveProperty('title');
      expect(result.data.items[0]).toHaveProperty('reason');
      expect(result.data.items[0]).toHaveProperty('content');
    });

    it('passes userId to service when authenticated', async () => {
      const authRequest: RequestWithUser = {
        headers: { authorization: 'Bearer test-token' },
        user: { id: 'user_1', email: 'a@b.com', sessionId: 'ses_1' },
      };
      mockService.getNowRecommendation!.mockResolvedValue(
        mockNowRecommendation(),
      );

      await controller.getNowRecommendation(authRequest);

      expect(mockService.getNowRecommendation).toHaveBeenCalledWith(
        'user_1',
        undefined,
      );
    });

    it('passes timezone header to service', async () => {
      mockService.getNowRecommendation!.mockResolvedValue(
        mockNowRecommendation(),
      );

      await controller.getNowRecommendation(
        anonymousRequest,
        'America/New_York',
      );

      expect(mockService.getNowRecommendation).toHaveBeenCalledWith(
        undefined,
        'America/New_York',
      );
    });

    it('works for anonymous users with demo recommendations', async () => {
      mockService.getNowRecommendation!.mockResolvedValue(
        mockNowRecommendation({
          recommendationId: 'rec_demo_now',
          explanation: 'A quieter lane for a late-hour session.',
        }),
      );

      const result = await controller.getNowRecommendation(
        anonymousRequest,
        'UTC',
      );

      expect(result.success).toBe(true);
      expect(result.data.recommendationId).toBe('rec_demo_now');
      expect(mockService.getNowRecommendation).toHaveBeenCalledWith(
        undefined,
        'UTC',
      );
    });
  });
});

describe('RecommendationService playable content selection', () => {
  const realAudioUrl = 'https://cdn.example.com/jamendo-real.mp3';
  const demoAudioUrl =
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  const realContent = {
    id: 'jamendo_track_1',
    contentType: ContentType.TRACK,
    canonicalTitle: 'Real Radar Track',
    subtitle: null,
    albumName: 'Real Album',
    primaryArtistNames: ['Real Artist'],
    durationMs: 180000,
    language: 'en',
    coverUrl: null,
    playable: true,
    releaseDate: null,
    metadataJson: { audioUrl: realAudioUrl },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    embedding: null,
  };
  const demoContent = {
    ...realContent,
    id: 'cnt_afterhours_loop',
    canonicalTitle: 'Afterhours Loop',
    primaryArtistNames: ['Quiet District'],
    metadataJson: { audioUrl: demoAudioUrl },
  };

  function createService(contentRows = [realContent]) {
    const prisma = {
      contentItem: {
        findMany: jest.fn(async (query?: { where?: unknown }) => {
          const serialized = JSON.stringify(query?.where ?? {});
          if (serialized.includes('providerMappings')) {
            return contentRows;
          }
          return [demoContent];
        }),
      },
    } as unknown as PrismaService;
    const contentService = {
      search: jest.fn().mockResolvedValue({
        items: [],
        meta: { page: 1, pageSize: 1, total: 0, hasMore: false },
      }),
      toContentItemDto: jest.fn((item: typeof realContent): ContentItemDto => {
        const metadata = item.metadataJson as { audioUrl?: string };
        return {
          id: item.id,
          type: 'track',
          title: item.canonicalTitle,
          artists: item.primaryArtistNames,
          album: item.albumName,
          durationMs: item.durationMs,
          language: item.language,
          coverUrl: item.coverUrl,
          audioUrl: metadata.audioUrl ?? null,
          playable: item.playable,
        };
      }),
    } as unknown as ContentService;

    return new RecommendationService(
      prisma,
      contentService,
      {} as ProfileService,
      {} as LlmService,
      {} as ContextService,
      {} as VectorSearchService,
      {} as EmbeddingService,
    );
  }

  it('prefers real playable provider tracks for anonymous radar', async () => {
    const service = createService([realContent]);

    const result = await service.getNowRecommendation(undefined, 'UTC');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].contentId).toBe('jamendo_track_1');
    expect(result.items[0].content.audioUrl).toBe(realAudioUrl);
  });

  it('returns only playable daily tracks with non-empty audioUrl', async () => {
    const service = createService([realContent]);

    const result = await service.getDailyPlaylist(undefined, 'UTC');

    expect(result.items[0].id).toBe('jamendo_track_1');
    expect(result.items.every((item) => item.type === 'track')).toBe(true);
    expect(result.items.every((item) => Boolean(item.audioUrl))).toBe(true);
  });
});
