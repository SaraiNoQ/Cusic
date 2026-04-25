import type {
  ApiSuccessEnvelope,
  DailyPlaylistDto,
  NowRecommendationDto,
} from '@music-ai/shared';
import { apiFetch } from './client';

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
