export const queryKeys = {
  search: (query: string) => ['search', query] as const,
  playlists: () => ['playlists'] as const,
  playlistDetail: (playlistId?: string | null) =>
    ['playlistDetail', playlistId ?? 'none'] as const,
  favorites: () => ['favorites'] as const,
  playerQueue: (userId?: string | null) =>
    ['playerQueue', userId ?? 'anonymous'] as const,
  related: (contentId?: string | null) =>
    ['related', contentId ?? 'none'] as const,
  recommendationNow: (userId?: string | null) =>
    ['recommendationNow', userId ?? 'anonymous'] as const,
  dailyPlaylist: (userId?: string | null) =>
    ['dailyPlaylist', userId ?? 'anonymous'] as const,
};
