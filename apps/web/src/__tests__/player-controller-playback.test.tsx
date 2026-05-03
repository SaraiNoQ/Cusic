import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ContentItemDto } from '@music-ai/shared';
import '@testing-library/jest-dom';
import {
  fetchContentById,
  fetchRelatedContent,
  searchContent,
} from '../lib/api/content-api';
import { fetchFavorites, fetchPlaylists } from '../lib/api/library-api';
import {
  fetchPlayerQueue,
  recordPlaybackEvent,
  syncQueue,
} from '../lib/api/player-api';
import {
  fetchDailyPlaylist,
  fetchNowRecommendation,
} from '../lib/api/recommendation-api';
import { usePlayerController } from '../features/player/hooks/usePlayerController';
import { usePlayerStore } from '../store/player-store';

jest.mock('../lib/api/content-api', () => ({
  fetchContentById: jest.fn(),
  fetchRelatedContent: jest.fn(),
  searchContent: jest.fn(),
}));

jest.mock('../lib/api/library-api', () => ({
  addPlaylistItem: jest.fn(),
  createFavorite: jest.fn(),
  fetchFavorites: jest.fn(),
  fetchPlaylists: jest.fn(),
  removeFavorite: jest.fn(),
}));

jest.mock('../lib/api/player-api', () => ({
  fetchPlayerQueue: jest.fn(),
  recordPlaybackEvent: jest.fn(),
  syncQueue: jest.fn(),
}));

jest.mock('../lib/api/recommendation-api', () => ({
  fetchDailyPlaylist: jest.fn(),
  fetchNowRecommendation: jest.fn(),
}));

const staleTrack: ContentItemDto = {
  id: 'jamendo_track_1',
  type: 'track',
  title: 'Radar Track',
  artists: ['Radar Artist'],
  album: 'Radar Album',
  durationMs: 200000,
  language: 'en',
  coverUrl: null,
  audioUrl: null,
  playable: true,
};

const hydratedTrack: ContentItemDto = {
  ...staleTrack,
  audioUrl: 'https://cdn.example.com/radar-track.mp3',
};

function resetPlayerStore() {
  usePlayerStore.setState({
    queue: [],
    currentTrack: null,
    activeIndex: -1,
    isPlaying: false,
    progressSeconds: 0,
    durationSeconds: 0,
    statusText: 'Calibrating player surface…',
    favoriteIds: [],
    selectedPlaylistId: '',
    volume: 0.8,
  });
}

function renderHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Harness() {
    const player = usePlayerController();
    return (
      <>
        <audio
          data-testid="player-audio"
          ref={player.audioRef}
          src={player.currentTrack?.audioUrl ?? undefined}
          onLoadedMetadata={player.audioHandlers.onLoadedMetadata}
          onTimeUpdate={player.audioHandlers.onTimeUpdate}
          onPlay={player.audioHandlers.onPlay}
          onPause={player.audioHandlers.onPause}
          onEnded={player.audioHandlers.onEnded}
        />
        <button type="button" onClick={() => void player.playTrack(staleTrack)}>
          Play radar
        </button>
        <button
          type="button"
          onClick={() => void player.addToQueue(staleTrack)}
        >
          Queue radar
        </button>
      </>
    );
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe('usePlayerController playback hydration', () => {
  const originalLoad = HTMLMediaElement.prototype.load;
  const originalPlay = HTMLMediaElement.prototype.play;

  beforeEach(() => {
    resetPlayerStore();
    jest.mocked(fetchContentById).mockResolvedValue(hydratedTrack);
    jest.mocked(fetchRelatedContent).mockResolvedValue([]);
    jest.mocked(searchContent).mockResolvedValue({
      success: true,
      data: { items: [] },
      meta: { page: 1, pageSize: 20, total: 0, hasMore: false },
    });
    jest.mocked(fetchFavorites).mockResolvedValue([]);
    jest.mocked(fetchPlaylists).mockResolvedValue([]);
    jest.mocked(fetchPlayerQueue).mockResolvedValue({
      queueId: 'queue_empty',
      count: 0,
      items: [],
      activeIndex: -1,
      currentTrack: null,
      positionMs: 0,
    });
    jest.mocked(fetchNowRecommendation).mockResolvedValue({
      recommendationId: 'rec_1',
      explanation: 'Radar',
      items: [],
    });
    jest.mocked(fetchDailyPlaylist).mockResolvedValue({
      playlistId: 'daily_1',
      title: 'Daily',
      description: 'Daily',
      itemCount: 0,
      recommendationResultId: null,
      items: [],
    });
    jest.mocked(syncQueue).mockResolvedValue({
      success: true,
      data: {
        queueId: 'queue_1',
        count: 1,
        items: [hydratedTrack],
        activeIndex: 0,
        currentTrack: hydratedTrack,
        positionMs: 0,
      },
      meta: {},
    });
    jest.mocked(recordPlaybackEvent).mockResolvedValue({
      success: true,
      data: { accepted: true, eventType: 'PLAY_STARTED', totalEvents: 1 },
      meta: {},
    });
    HTMLMediaElement.prototype.load = jest.fn();
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    HTMLMediaElement.prototype.load = originalLoad;
    HTMLMediaElement.prototype.play = originalPlay;
    jest.clearAllMocks();
  });

  it('hydrates radar content and replaces a stale same-id queue item', async () => {
    usePlayerStore.setState({
      queue: [
        { ...staleTrack, audioUrl: 'https://default.example.com/demo.mp3' },
      ],
      currentTrack: null,
      activeIndex: 0,
    });

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'Play radar' }));

    await waitFor(() =>
      expect(usePlayerStore.getState().currentTrack?.audioUrl).toBe(
        hydratedTrack.audioUrl,
      ),
    );

    expect(fetchContentById).toHaveBeenCalledWith(staleTrack.id);
    expect(usePlayerStore.getState().queue[0].audioUrl).toBe(
      hydratedTrack.audioUrl,
    );
    expect(syncQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        currentContentId: hydratedTrack.id,
        items: [{ contentId: hydratedTrack.id }],
      }),
    );
  });

  it('hydrates an existing same-id queue item when radar queues it again', async () => {
    usePlayerStore.setState({
      queue: [
        { ...staleTrack, audioUrl: 'https://default.example.com/demo.mp3' },
      ],
      currentTrack: null,
      activeIndex: 0,
    });

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'Queue radar' }));

    await waitFor(() =>
      expect(usePlayerStore.getState().queue[0].audioUrl).toBe(
        hydratedTrack.audioUrl,
      ),
    );

    expect(fetchContentById).toHaveBeenCalledWith(staleTrack.id);
    expect(syncQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        currentContentId: hydratedTrack.id,
        items: [{ contentId: hydratedTrack.id }],
      }),
    );
  });

  it('reloads the audio element when the hydrated audioUrl becomes current', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'Play radar' }));

    const audio = await screen.findByTestId('player-audio');
    await waitFor(() =>
      expect(HTMLMediaElement.prototype.load).toHaveBeenCalled(),
    );

    fireEvent.canPlay(audio);

    await waitFor(() =>
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled(),
    );
  });
});
