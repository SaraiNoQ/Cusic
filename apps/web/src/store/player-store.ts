import type { ContentItemDto } from '@music-ai/shared';
import { create } from 'zustand';

type PlayerStore = {
  queue: ContentItemDto[];
  currentTrack: ContentItemDto | null;
  activeIndex: number;
  isPlaying: boolean;
  progressSeconds: number;
  durationSeconds: number;
  statusText: string;
  favoriteIds: string[];
  selectedPlaylistId: string;
  setStatusText: (statusText: string) => void;
  setQueue: (queue: ContentItemDto[]) => void;
  setCurrentTrack: (track: ContentItemDto | null) => void;
  setActiveIndex: (index: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setProgressSeconds: (seconds: number) => void;
  setDurationSeconds: (seconds: number) => void;
  setFavoriteIds: (favoriteIds: string[]) => void;
  toggleFavoriteId: (contentId: string) => void;
  setSelectedPlaylistId: (playlistId: string) => void;
};

export const usePlayerStore = create<PlayerStore>((set) => ({
  queue: [],
  currentTrack: null,
  activeIndex: -1,
  isPlaying: false,
  progressSeconds: 0,
  durationSeconds: 0,
  statusText: 'Calibrating player surface…',
  favoriteIds: [],
  selectedPlaylistId: '',
  setStatusText: (statusText) => set({ statusText }),
  setQueue: (queue) => set({ queue }),
  setCurrentTrack: (currentTrack) => set({ currentTrack }),
  setActiveIndex: (activeIndex) => set({ activeIndex }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setProgressSeconds: (progressSeconds) => set({ progressSeconds }),
  setDurationSeconds: (durationSeconds) => set({ durationSeconds }),
  setFavoriteIds: (favoriteIds) => set({ favoriteIds }),
  toggleFavoriteId: (contentId) =>
    set((state) => ({
      favoriteIds: state.favoriteIds.includes(contentId)
        ? state.favoriteIds.filter((id) => id !== contentId)
        : [...state.favoriteIds, contentId],
    })),
  setSelectedPlaylistId: (selectedPlaylistId) => set({ selectedPlaylistId }),
}));
