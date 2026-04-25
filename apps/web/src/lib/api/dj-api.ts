import type {
  ApiSuccessEnvelope,
  ChatSessionMessageDto,
  ChatTurnRequestDto,
  ChatTurnResponseDto,
} from '@music-ai/shared';
import { apiFetch } from './client';

export type ChatResponse = ApiSuccessEnvelope<ChatTurnResponseDto>;

export async function submitDjMessage(input: ChatTurnRequestDto) {
  return apiFetch<ChatResponse>('/dj/chat', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchDjSessionMessages(sessionId: string) {
  const response = await apiFetch<ApiSuccessEnvelope<ChatSessionMessageDto[]>>(
    `/dj/sessions/${sessionId}/messages`,
  );

  return response.data;
}
