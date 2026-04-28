import type {
  AiDjStreamEventDto,
  ApiSuccessEnvelope,
  ChatSessionMessageDto,
  ChatTurnRequestDto,
  ChatTurnResponseDto,
  SaveAiPlaylistRequestDto,
  SaveAiPlaylistResponseDto,
} from '@music-ai/shared';
import { readAuthSession } from './auth-session';
import { apiFetch, getApiBaseUrl } from './client';

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

export async function saveAiPlaylist(input: SaveAiPlaylistRequestDto) {
  const response = await apiFetch<
    ApiSuccessEnvelope<SaveAiPlaylistResponseDto>
  >('/dj/playlists', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function streamDjMessage(
  input: {
    sessionId: string;
    messageId: string;
  },
  onEvent: (event: AiDjStreamEventDto) => void,
  signal?: AbortSignal,
) {
  const session = readAuthSession();
  const url = new URL(`${getApiBaseUrl()}/dj/chat/stream`);
  url.searchParams.set('sessionId', input.sessionId);
  url.searchParams.set('messageId', input.messageId);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'text/event-stream',
      ...(session?.accessToken
        ? { Authorization: `Bearer ${session.accessToken}` }
        : {}),
    },
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flushEvent = (rawEvent: string) => {
    const lines = rawEvent
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return;
    }

    const eventType =
      lines
        .find((line) => line.startsWith('event:'))
        ?.slice(6)
        .trim() ?? 'message';
    const dataPayload = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => (line[5] === ' ' ? line.slice(6) : line.slice(5)))
      .join('\n');

    if (!dataPayload) {
      return;
    }

    onEvent({
      event: eventType,
      ...JSON.parse(dataPayload),
    } as AiDjStreamEventDto);
  };

  const streamTimeoutMs = 90_000;
  const startedAt = Date.now();

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      break;
    }

    if (Date.now() - startedAt > streamTimeoutMs) {
      reader.cancel();
      throw new Error('Stream timed out after 90 seconds');
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      flushEvent(part);
    }
  }

  if (buffer.trim()) {
    flushEvent(buffer);
  }
}
