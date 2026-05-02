import { LibraryController } from '../../src/modules/library/controllers/library.controller';
import type { LibraryService } from '../../src/modules/library/services/library.service';
import type {
  FavoriteSummaryDto,
  PlaylistDetailDto,
  PlaylistSummaryDto,
} from '@music-ai/shared';
import type { RequestWithUser } from '../../src/modules/auth/guards/jwt-auth.guard';

function playlist(
  overrides: Partial<PlaylistSummaryDto> = {},
): PlaylistSummaryDto {
  return {
    id: 'pl_1',
    title: 'Focus Lane',
    description: 'A persistent user playlist.',
    playlistType: 'user_created',
    itemCount: 0,
    ...overrides,
  };
}

describe('LibraryController (integration)', () => {
  let controller: LibraryController;
  let mockService: Record<string, jest.Mock>;

  const anonymousRequest: RequestWithUser = {
    headers: {},
    user: undefined,
  };

  const authenticatedRequest: RequestWithUser = {
    headers: { authorization: 'Bearer test-token' },
    user: { id: 'user_1', email: 'a@b.com', sessionId: 'ses_1' },
  };

  beforeEach(() => {
    mockService = {
      listPlaylists: jest.fn(),
      createPlaylist: jest.fn(),
      getPlaylistDetail: jest.fn(),
      updatePlaylist: jest.fn(),
      deletePlaylist: jest.fn(),
      addItems: jest.fn(),
      removeItem: jest.fn(),
      listFavorites: jest.fn(),
      createFavorite: jest.fn(),
      removeFavorite: jest.fn(),
    };
    controller = new LibraryController(
      mockService as unknown as LibraryService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists authenticated user playlists', async () => {
    mockService.listPlaylists!.mockResolvedValue([
      playlist({ id: 'pl_1' }),
      playlist({ id: 'pl_2', title: 'Night Radio' }),
    ]);

    const result = await controller.listPlaylists(authenticatedRequest);

    expect(result.success).toBe(true);
    expect(result.data.items).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(mockService.listPlaylists).toHaveBeenCalledWith('user_1');
  });

  it('keeps anonymous playlist fallback routed through the service', async () => {
    mockService.listPlaylists!.mockResolvedValue([
      playlist({ id: 'pl_demo', playlistType: 'daily' }),
    ]);

    const result = await controller.listPlaylists(anonymousRequest);

    expect(result.success).toBe(true);
    expect(result.data.items[0].id).toBe('pl_demo');
    expect(mockService.listPlaylists).toHaveBeenCalledWith(undefined);
  });

  it('creates a playlist for the authenticated user', async () => {
    mockService.createPlaylist!.mockResolvedValue(
      playlist({ id: 'pl_new', title: 'Morning Set' }),
    );

    const result = await controller.createPlaylist(
      { title: 'Morning Set', description: 'Start here.' },
      authenticatedRequest,
    );

    expect(result.success).toBe(true);
    expect(result.data.id).toBe('pl_new');
    expect(mockService.createPlaylist).toHaveBeenCalledWith(
      'Morning Set',
      'Start here.',
      'user_1',
    );
  });

  it('returns playlist detail envelope', async () => {
    const detail: PlaylistDetailDto = {
      ...playlist({ id: 'pl_1' }),
      items: [],
    };
    mockService.getPlaylistDetail!.mockResolvedValue(detail);

    const result = await controller.getPlaylistDetail(
      'pl_1',
      authenticatedRequest,
    );

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('pl_1');
    expect(mockService.getPlaylistDetail).toHaveBeenCalledWith(
      'pl_1',
      'user_1',
    );
  });

  it('returns a deterministic add-items fallback when service declines', async () => {
    mockService.addItems!.mockResolvedValue(null);

    const result = await controller.addPlaylistItems(
      'pl_missing',
      { contentIds: ['cnt_a', 'cnt_b'] },
      anonymousRequest,
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      playlistId: 'pl_missing',
      addedCount: 0,
      skippedCount: 2,
      itemCount: 0,
    });
    expect(mockService.addItems).toHaveBeenCalledWith(
      'pl_missing',
      ['cnt_a', 'cnt_b'],
      undefined,
    );
  });

  it('creates and removes favorites through the user path', async () => {
    const favorite: FavoriteSummaryDto = {
      contentId: 'cnt_a',
      favoriteType: 'track',
    };
    mockService.createFavorite!.mockResolvedValue(favorite);
    mockService.removeFavorite!.mockResolvedValue({
      contentId: 'cnt_a',
      removed: true,
    });

    const createResult = await controller.createFavorite(
      favorite,
      authenticatedRequest,
    );
    const removeResult = await controller.removeFavorite(
      'cnt_a',
      authenticatedRequest,
    );

    expect(createResult.success).toBe(true);
    expect(createResult.data.contentId).toBe('cnt_a');
    expect(removeResult.success).toBe(true);
    expect(mockService.createFavorite).toHaveBeenCalledWith(favorite, 'user_1');
    expect(mockService.removeFavorite).toHaveBeenCalledWith('cnt_a', 'user_1');
  });
});
