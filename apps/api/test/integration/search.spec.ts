import { ContentController } from '../../src/modules/content/controllers/content.controller';
import type { ContentService } from '../../src/modules/content/services/content.service';
import type { ContentItemDto, PaginationMeta } from '@music-ai/shared';

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

describe('ContentController (integration)', () => {
  let controller: ContentController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      search: jest.fn(),
      getById: jest.fn(),
      getByIds: jest.fn(),
      getRelated: jest.fn(),
    };
    controller = new ContentController(
      mockService as unknown as ContentService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /search?q=love ────────────────────────────────────────────
  describe('search()', () => {
    it('returns 200-style envelope with items for a valid query', async () => {
      const matchedItem = mockContentItem({
        id: 'cnt_love_song',
        title: 'Love Song',
        artists: ['Romantic Ensemble'],
      });

      const meta: PaginationMeta = {
        page: 1,
        pageSize: 20,
        total: 1,
        hasMore: false,
      };
      mockService.search!.mockResolvedValue({ items: [matchedItem], meta });

      const result = await controller.search({ q: 'love' });

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].title).toBe('Love Song');
      expect(result.data.items[0].id).toBe('cnt_love_song');
      expect(result.meta).toEqual(meta);
      expect(mockService.search).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'love' }),
      );
    });

    it('returns empty items array for a query matching nothing', async () => {
      const meta: PaginationMeta = {
        page: 1,
        pageSize: 20,
        total: 0,
        hasMore: false,
      };
      mockService.search!.mockResolvedValue({ items: [], meta });

      const result = await controller.search({ q: 'zzzz_not_found' });

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(0);
      expect(mockService.search).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'zzzz_not_found' }),
      );
    });

    it('handles empty query string gracefully', async () => {
      const meta: PaginationMeta = {
        page: 1,
        pageSize: 20,
        total: 3,
        hasMore: false,
      };
      mockService.search!.mockResolvedValue({
        items: [
          mockContentItem(),
          mockContentItem({ id: 'cnt_2' }),
          mockContentItem({ id: 'cnt_3' }),
        ],
        meta,
      });

      const result = await controller.search({ q: '' });

      expect(result.success).toBe(true);
      expect(result.data.items.length).toBeGreaterThanOrEqual(0);
      expect(mockService.search).toHaveBeenCalledWith(
        expect.objectContaining({ q: '' }),
      );
    });
  });

  // ── GET /content/:id ──────────────────────────────────────────────
  describe('getContent()', () => {
    it('returns the content item when found', async () => {
      const item = mockContentItem({
        id: 'cnt_editorial_dusk',
        title: 'Editorial Dusk',
      });
      mockService.getById!.mockResolvedValue(item);

      const result = await controller.getContent('cnt_editorial_dusk');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('cnt_editorial_dusk');
      expect(result.data.title).toBe('Editorial Dusk');
    });

    it('returns a fallback item when not found', async () => {
      mockService.getById!.mockResolvedValue(null);

      const result = await controller.getContent('cnt_missing');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('cnt_missing');
      expect(result.data.title).toBe('Unknown Content');
    });
  });
});
