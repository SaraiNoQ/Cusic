import type {
  ApiSuccessEnvelope,
  FavoriteDto,
  FavoriteSummaryDto,
  PlaylistSummaryDto,
} from '@music-ai/shared';
import { apiFetch } from './client';

export type PlaylistResponse = ApiSuccessEnvelope<{
  items: PlaylistSummaryDto[];
}> & {
  meta?: { total?: number };
};

export async function fetchPlaylists() {
  const response = await apiFetch<PlaylistResponse>('/library/playlists');
  return response.data.items;
}

export type FavoriteResponse = ApiSuccessEnvelope<{
  items: FavoriteSummaryDto[];
}> & {
  meta?: { total?: number };
};

export async function fetchFavorites() {
  const response = await apiFetch<FavoriteResponse>('/library/favorites');
  return response.data.items;
}

export async function createFavorite(payload: FavoriteDto) {
  return apiFetch<ApiSuccessEnvelope<{ contentId: string }>>(
    '/library/favorites',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function removeFavorite(contentId: string) {
  return apiFetch<ApiSuccessEnvelope<{ removed: boolean }>>(
    `/library/favorites/${contentId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function addPlaylistItem(playlistId: string, contentId: string) {
  return apiFetch<ApiSuccessEnvelope<{ addedCount: number }>>(
    `/library/playlists/${playlistId}/items`,
    {
      method: 'POST',
      body: JSON.stringify({
        contentIds: [contentId],
      }),
    },
  );
}
