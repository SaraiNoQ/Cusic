'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ContentItemDto,
  FavoriteDto,
  PlaybackEventPayloadDto,
  QueueUpdateDto,
} from '@music-ai/shared';
import { useEffect, useMemo, useRef } from 'react';
import type { SyntheticEvent } from 'react';
import {
  fetchRelatedContent,
  searchContent,
} from '../../../lib/api/content-api';
import {
  addPlaylistItem,
  createFavorite,
  fetchPlaylists,
  removeFavorite,
} from '../../../lib/api/library-api';
import { recordPlaybackEvent, syncQueue } from '../../../lib/api/player-api';
import { queryKeys } from '../../../lib/query/query-keys';
import { usePlayerStore } from '../../../store/player-store';

export type PlayerController = ReturnType<typeof usePlayerController>;

export function usePlayerController() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queue = usePlayerStore((state) => state.queue);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const activeIndex = usePlayerStore((state) => state.activeIndex);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const progressSeconds = usePlayerStore((state) => state.progressSeconds);
  const durationSeconds = usePlayerStore((state) => state.durationSeconds);
  const statusText = usePlayerStore((state) => state.statusText);
  const favoriteIds = usePlayerStore((state) => state.favoriteIds);
  const selectedPlaylistId = usePlayerStore(
    (state) => state.selectedPlaylistId,
  );
  const setQueue = usePlayerStore((state) => state.setQueue);
  const setCurrentTrack = usePlayerStore((state) => state.setCurrentTrack);
  const setActiveIndex = usePlayerStore((state) => state.setActiveIndex);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setProgressSeconds = usePlayerStore(
    (state) => state.setProgressSeconds,
  );
  const setDurationSeconds = usePlayerStore(
    (state) => state.setDurationSeconds,
  );
  const setStatusText = usePlayerStore((state) => state.setStatusText);
  const toggleFavoriteId = usePlayerStore((state) => state.toggleFavoriteId);
  const setSelectedPlaylistId = usePlayerStore(
    (state) => state.setSelectedPlaylistId,
  );

  const playlistsQuery = useQuery({
    queryKey: queryKeys.playlists(),
    queryFn: fetchPlaylists,
  });

  const relatedQuery = useQuery({
    queryKey: queryKeys.related(currentTrack?.id),
    queryFn: async () => fetchRelatedContent(currentTrack!.id),
    enabled: Boolean(currentTrack?.id),
  });

  const queueMutation = useMutation({
    mutationFn: (payload: QueueUpdateDto) => syncQueue(payload),
  });

  const eventMutation = useMutation({
    mutationFn: (payload: PlaybackEventPayloadDto) =>
      recordPlaybackEvent(payload),
  });

  const favoriteCreateMutation = useMutation({
    mutationFn: (payload: FavoriteDto) => createFavorite(payload),
  });

  const favoriteRemoveMutation = useMutation({
    mutationFn: (contentId: string) => removeFavorite(contentId),
  });

  const playlistItemMutation = useMutation({
    mutationFn: ({
      playlistId,
      contentId,
    }: {
      playlistId: string;
      contentId: string;
    }) => addPlaylistItem(playlistId, contentId),
  });

  useEffect(() => {
    if (!selectedPlaylistId && playlistsQuery.data?.[0]?.id) {
      setSelectedPlaylistId(playlistsQuery.data[0].id);
    }
  }, [playlistsQuery.data, selectedPlaylistId, setSelectedPlaylistId]);

  useEffect(() => {
    if (currentTrack || queue.length > 0) {
      return;
    }

    void searchContent('night')
      .then((response) => {
        const first = response.data.items[0];
        if (!first) {
          return;
        }

        setQueue([first]);
        setCurrentTrack(first);
        setActiveIndex(0);
        setStatusText('Player field synchronized.');
        return syncQueueState('replace', [first]);
      })
      .catch(() => {
        setStatusText('Initial bootstrap failed. Check API connectivity.');
      });
  }, [
    currentTrack,
    queue.length,
    setActiveIndex,
    setCurrentTrack,
    setQueue,
    setStatusText,
  ]);

  useEffect(() => {
    if (playlistsQuery.isSuccess && queue.length === 0) {
      setStatusText('Player field synchronized.');
    } else if (playlistsQuery.isError) {
      setStatusText('Initial bootstrap failed. Check API connectivity.');
    }
  }, [
    playlistsQuery.isSuccess,
    playlistsQuery.isError,
    queue.length,
    setStatusText,
  ]);

  const relatedItems = relatedQuery.data ?? [];
  const playlists = playlistsQuery.data ?? [];

  const syncQueueState = async (
    mode: 'replace' | 'append',
    items: ContentItemDto[],
  ) => {
    await queueMutation.mutateAsync({
      mode,
      items: items.map((item) => ({ contentId: item.id })),
    });
  };

  const recordEvent = async (
    contentId: string,
    eventType: PlaybackEventPayloadDto['eventType'],
    positionMs?: number,
  ) => {
    try {
      await eventMutation.mutateAsync({
        contentId,
        eventType,
        positionMs,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      setStatusText(
        'Playback event stayed local because the telemetry lane did not answer.',
      );
    }
  };

  const replaceQueue = async (items: ContentItemDto[], message?: string) => {
    setQueue(items);
    setCurrentTrack(items[0] ?? null);
    setActiveIndex(items.length > 0 ? 0 : -1);
    setProgressSeconds(0);
    if (items.length > 0) {
      await syncQueueState('replace', items);
    }
    if (message) {
      setStatusText(message);
    }
  };

  const playTrack = async (track: ContentItemDto) => {
    const existingIndex = queue.findIndex((item) => item.id === track.id);
    if (existingIndex >= 0) {
      setCurrentTrack(track);
      setActiveIndex(existingIndex);
      setProgressSeconds(0);
      setStatusText(`Locked on ${track.title}.`);
      return;
    }

    const nextQueue = [...queue, track];
    setQueue(nextQueue);
    setCurrentTrack(track);
    setActiveIndex(nextQueue.length - 1);
    setProgressSeconds(0);
    await syncQueueState(queue.length === 0 ? 'replace' : 'append', nextQueue);
    setStatusText(`Queued ${track.title} into the active listening lane.`);
  };

  const addToQueue = async (track: ContentItemDto) => {
    if (queue.some((item) => item.id === track.id)) {
      setStatusText(`${track.title} is already inside the queue ring.`);
      return;
    }

    const nextQueue = [...queue, track];
    setQueue(nextQueue);
    if (!currentTrack) {
      setCurrentTrack(track);
      setActiveIndex(0);
      setProgressSeconds(0);
    }
    await syncQueueState(queue.length === 0 ? 'replace' : 'append', nextQueue);
    setStatusText(`Added ${track.title} to the queue ring.`);
  };

  const playQueueIndex = async (index: number) => {
    const target = queue[index];
    if (!target) {
      return;
    }

    setCurrentTrack(target);
    setActiveIndex(index);
    setProgressSeconds(0);
    setStatusText(`Switched to ${target.title}.`);
  };

  const playPrevious = async () => {
    if (activeIndex <= 0) {
      setStatusText('You are already at the head of the queue.');
      return;
    }

    if (currentTrack) {
      await recordEvent(currentTrack.id, 'SKIPPED', progressSeconds * 1000);
    }

    await playQueueIndex(activeIndex - 1);
  };

  const playNext = async () => {
    if (activeIndex >= queue.length - 1) {
      setStatusText('The queue has reached its current edge.');
      return;
    }

    if (currentTrack) {
      await recordEvent(currentTrack.id, 'SKIPPED', progressSeconds * 1000);
    }

    await playQueueIndex(activeIndex + 1);
  };

  const toggleFavorite = async (track: ContentItemDto) => {
    const isFavorite = favoriteIds.includes(track.id);

    if (isFavorite) {
      await favoriteRemoveMutation.mutateAsync(track.id);
      toggleFavoriteId(track.id);
      setStatusText(`Removed ${track.title} from the vault.`);
      return;
    }

    await favoriteCreateMutation.mutateAsync({
      contentId: track.id,
      favoriteType: track.type,
    });
    toggleFavoriteId(track.id);
    setStatusText(`Saved ${track.title} to the vault.`);
  };

  const addCurrentTrackToPlaylist = async (track: ContentItemDto) => {
    if (!selectedPlaylistId) {
      setStatusText('No playlist is armed yet.');
      return;
    }

    await playlistItemMutation.mutateAsync({
      playlistId: selectedPlaylistId,
      contentId: track.id,
    });

    playlistsQuery.refetch();
    const playlistTitle =
      playlists.find((item) => item.id === selectedPlaylistId)?.title ??
      'your active playlist';
    setStatusText(`Added ${track.title} to ${playlistTitle}.`);
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      setStatusText('Autoplay was blocked. Tap play to continue.');
    }
  };

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setIsPlaying(false);
      });
  }, [currentTrack, setIsPlaying]);

  const audioHandlers = useMemo(
    () => ({
      onLoadedMetadata: (event: SyntheticEvent<HTMLAudioElement>) => {
        setDurationSeconds(event.currentTarget.duration || 0);
      },
      onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement>) => {
        setProgressSeconds(event.currentTarget.currentTime || 0);
      },
      onPlay: () => {
        setIsPlaying(true);
        if (currentTrack) {
          void recordEvent(
            currentTrack.id,
            'PLAY_STARTED',
            progressSeconds * 1000,
          );
        }
      },
      onPause: (event: SyntheticEvent<HTMLAudioElement>) => {
        if (event.currentTarget.ended) {
          return;
        }

        setIsPlaying(false);
        if (currentTrack) {
          void recordEvent(
            currentTrack.id,
            'PLAY_PAUSED',
            progressSeconds * 1000,
          );
        }
      },
      onEnded: () => {
        setIsPlaying(false);
        if (currentTrack) {
          void recordEvent(
            currentTrack.id,
            'PLAY_COMPLETED',
            progressSeconds * 1000,
          );
        }
        if (activeIndex < queue.length - 1) {
          void playQueueIndex(activeIndex + 1);
        }
      },
    }),
    [
      activeIndex,
      currentTrack,
      progressSeconds,
      queue.length,
      setDurationSeconds,
      setIsPlaying,
      setProgressSeconds,
    ],
  );

  return {
    audioRef,
    audioHandlers,
    playlists,
    relatedItems,
    queue,
    currentTrack,
    activeIndex,
    isPlaying,
    progressSeconds,
    durationSeconds,
    statusText,
    favoriteIds,
    selectedPlaylistId,
    setSelectedPlaylistId,
    playTrack,
    addToQueue,
    playQueueIndex,
    playPrevious,
    playNext,
    togglePlayPause,
    toggleFavorite,
    addCurrentTrackToPlaylist,
    replaceQueue,
  };
}
