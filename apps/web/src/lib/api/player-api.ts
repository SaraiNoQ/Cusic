import type {
  ApiSuccessEnvelope,
  PlaybackEventPayloadDto,
  QueueUpdateDto,
} from '@music-ai/shared';
import { apiFetch } from './client';

export async function syncQueue(payload: QueueUpdateDto) {
  return apiFetch<ApiSuccessEnvelope<{ queueId: string; count: number }>>(
    '/player/queue',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function recordPlaybackEvent(payload: PlaybackEventPayloadDto) {
  return apiFetch<ApiSuccessEnvelope<{ accepted: boolean }>>('/player/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
