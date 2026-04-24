import type {
  ApiSuccessEnvelope,
  PlaybackEventPayloadDto,
  PlayerQueueStateDto,
  QueueUpdateDto,
} from '@music-ai/shared';
import { apiFetch } from './client';

export async function fetchPlayerQueue() {
  const response =
    await apiFetch<ApiSuccessEnvelope<PlayerQueueStateDto>>('/player/queue');
  return response.data;
}

export async function syncQueue(payload: QueueUpdateDto) {
  return apiFetch<ApiSuccessEnvelope<PlayerQueueStateDto>>('/player/queue', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function recordPlaybackEvent(payload: PlaybackEventPayloadDto) {
  return apiFetch<ApiSuccessEnvelope<{ accepted: boolean }>>('/player/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
