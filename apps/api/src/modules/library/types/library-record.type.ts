export type FavoriteRecord = {
  contentId: string;
  favoriteType: 'track' | 'podcast' | 'radio' | 'album';
};

export type PlaylistSummaryRecord = {
  id: string;
  title: string;
  description: string;
  playlistType: 'user_created' | 'ai_generated' | 'daily' | 'imported';
  itemCount: number;
};

export type PlaylistRecord = PlaylistSummaryRecord & {
  contentIds: string[];
};
