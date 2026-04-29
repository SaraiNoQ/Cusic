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
  importJobs: (userId?: string | null) =>
    ['importJobs', userId ?? 'anonymous'] as const,
  tasteReport: () => ['tasteReport'] as const,
};

export const knowledgeKeys = {
  all: ['knowledge'] as const,
  traces: () => [...knowledgeKeys.all, 'traces'] as const,
  trace: (id: string) => [...knowledgeKeys.all, 'trace', id] as const,
} as const;

export const voiceKeys = {
  all: ['voice'] as const,
  tts: (text: string) => [...voiceKeys.all, 'tts', text] as const,
} as const;
