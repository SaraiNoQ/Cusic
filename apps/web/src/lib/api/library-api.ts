import type {
  ApiSuccessEnvelope,
  FavoriteDto,
  FavoriteSummaryDto,
  PlaylistDeleteResponseDto,
  PlaylistDetailDto,
  PlaylistItemRemovalResponseDto,
  PlaylistItemsAppendResponseDto,
  PlaylistSummaryDto,
  PlaylistUpdateResponseDto,
  UpdatePlaylistDto,
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

export type PlaylistDetailResponse = ApiSuccessEnvelope<PlaylistDetailDto | null>;

export async function fetchPlaylistDetail(playlistId: string) {
  const response = await apiFetch<PlaylistDetailResponse>(
    `/library/playlists/${playlistId}`,
  );
  return response.data;
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
  return apiFetch<ApiSuccessEnvelope<PlaylistItemsAppendResponseDto>>(
    `/library/playlists/${playlistId}/items`,
    {
      method: 'POST',
      body: JSON.stringify({
        contentIds: [contentId],
      }),
    },
  );
}

export async function updatePlaylist(
  playlistId: string,
  payload: UpdatePlaylistDto,
) {
  return apiFetch<ApiSuccessEnvelope<PlaylistUpdateResponseDto>>(
    `/library/playlists/${playlistId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

export async function deletePlaylist(playlistId: string) {
  return apiFetch<ApiSuccessEnvelope<PlaylistDeleteResponseDto>>(
    `/library/playlists/${playlistId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function removePlaylistItem(
  playlistId: string,
  contentId: string,
) {
  return apiFetch<ApiSuccessEnvelope<PlaylistItemRemovalResponseDto>>(
    `/library/playlists/${playlistId}/items/${contentId}`,
    {
      method: 'DELETE',
    },
  );
}
