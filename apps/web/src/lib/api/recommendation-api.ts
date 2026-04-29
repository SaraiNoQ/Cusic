import type {
  ApiSuccessEnvelope,
  DailyPlaylistDto,
  NowRecommendationDto,
  PlaylistSummaryDto,
  RecommendationFeedbackDto,
} from '@music-ai/shared';
import { apiFetch } from './client';
import { addPlaylistItem, createPlaylist } from './library-api';

export async function fetchNowRecommendation() {
  const response =
    await apiFetch<ApiSuccessEnvelope<NowRecommendationDto>>('/recommend/now');
  return response.data;
}

export async function fetchDailyPlaylist() {
  const response =
    await apiFetch<ApiSuccessEnvelope<DailyPlaylistDto>>('/playlist/daily');
  return response.data;
}

export async function submitFeedback(
  dto: RecommendationFeedbackDto,
): Promise<void> {
  await apiFetch<ApiSuccessEnvelope<{ recorded: boolean }>>('/feedback', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function saveDailyPlaylist(
  dailyPlaylist: DailyPlaylistDto,
): Promise<PlaylistSummaryDto> {
  const playlist = await createPlaylist({
    title: dailyPlaylist.title ?? 'Today in Cusic',
    description: dailyPlaylist.description ?? '',
  });

  if (playlist && playlist.id && dailyPlaylist.items.length > 0) {
    const contentIds = dailyPlaylist.items.map((item) => item.id);
    await addPlaylistItem(playlist.id, contentIds[0]);
    for (let i = 1; i < contentIds.length; i++) {
      await addPlaylistItem(playlist.id, contentIds[i]);
    }
  }

  return playlist;
}
