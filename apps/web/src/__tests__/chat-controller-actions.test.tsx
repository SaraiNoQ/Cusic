import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AiDjActionDto, ContentItemDto } from '@music-ai/shared';
import '@testing-library/jest-dom';
import { fetchContentById } from '../lib/api/content-api';
import { streamDjMessage, submitDjMessage } from '../lib/api/dj-api';
import { useChatController } from '../features/chat/hooks/useChatController';
import { initialChatMessages, useChatStore } from '../store/chat-store';

jest.mock('../lib/api/content-api', () => ({
  fetchContentById: jest.fn(),
}));

jest.mock('../lib/api/dj-api', () => ({
  fetchDjSessionMessages: jest.fn(),
  saveAiPlaylist: jest.fn(),
  streamDjMessage: jest.fn(),
  submitDjMessage: jest.fn(),
}));

const track: ContentItemDto = {
  id: 'cnt_jazz_1',
  type: 'track',
  title: 'Blue Hour',
  artists: ['Night Trio'],
  album: 'After Dark',
  durationMs: 180000,
  language: 'instrumental',
  coverUrl: null,
  audioUrl: 'https://example.com/blue-hour.mp3',
  playable: true,
};

const action: AiDjActionDto = {
  type: 'queue_replace',
  payload: { contentIds: [track.id] },
};

function renderController(playerController: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Harness() {
    const controller = useChatController(playerController as never);
    return (
      <button
        type="button"
        onClick={() => void controller.sendMessage('来一首爵士')}
      >
        Send DJ command
      </button>
    );
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe('useChatController action execution', () => {
  beforeEach(() => {
    useChatStore.setState({
      sessionId: undefined,
      input: '',
      isPending: false,
      streamingMessageId: null,
      messages: initialChatMessages,
      hasHydratedSession: false,
      chatError: null,
    });
    jest.mocked(fetchContentById).mockResolvedValue(track);
    jest.mocked(submitDjMessage).mockResolvedValue({
      success: true,
      data: {
        sessionId: 'ses_1',
        messageId: 'msg_1',
        intent: 'queue_replace',
        replyText: '已切换到 Blue Hour。',
        actions: [action],
      },
      meta: {},
    });
    jest.mocked(streamDjMessage).mockImplementation(async (_input, onEvent) => {
      onEvent({
        event: 'actions',
        sessionId: 'ses_1',
        messageId: 'msg_1',
        actions: [action],
      });
      onEvent({
        event: 'done',
        sessionId: 'ses_1',
        messageId: 'msg_1',
        replyText: '已切换到 Blue Hour。',
        intent: 'queue_replace',
        actions: [action],
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('executes duplicate stream and done actions only once', async () => {
    const replaceQueue = jest.fn().mockResolvedValue(undefined);
    const appendTracks = jest.fn().mockResolvedValue(undefined);

    renderController({
      currentTrack: null,
      queue: [],
      replaceQueue,
      appendTracks,
      setSelectedPlaylistId: jest.fn(),
      refreshPlaylists: jest.fn(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send DJ command' }));

    await waitFor(() => expect(replaceQueue).toHaveBeenCalledTimes(1));
    expect(replaceQueue).toHaveBeenCalledWith(
      [track],
      'AI DJ rewired the active queue.',
    );
    expect(appendTracks).not.toHaveBeenCalled();
  });
});
