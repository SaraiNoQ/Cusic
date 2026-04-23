import type { AiDjActionDto, ApiSuccessEnvelope } from '@music-ai/shared';
import { apiFetch } from './client';

export type ChatResponse = ApiSuccessEnvelope<{
  sessionId: string;
  messageId: string;
  replyText: string;
  actions: AiDjActionDto[];
}>;

export async function submitDjMessage(input: {
  sessionId?: string;
  message: string;
  responseMode: 'sync' | 'stream';
}) {
  return apiFetch<ChatResponse>('/dj/chat', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
