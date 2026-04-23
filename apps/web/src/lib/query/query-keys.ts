export const queryKeys = {
  search: (query: string) => ['search', query] as const,
  playlists: () => ['playlists'] as const,
  related: (contentId?: string | null) =>
    ['related', contentId ?? 'none'] as const,
};
