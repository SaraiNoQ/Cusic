import { Injectable } from '@nestjs/common';
import { ContentService } from '../../content/services/content.service';
import type {
  FavoriteRecord,
  PlaylistRecord,
} from '../types/library-record.type';

@Injectable()
export class LibraryService {
  private playlists: PlaylistRecord[] = [
    {
      id: 'pl_desk_warmup',
      title: 'Desk Warmup',
      description: 'A default playlist for the player demo workspace.',
      playlistType: 'daily',
      itemCount: 2,
      contentIds: ['cnt_editorial_dusk', 'cnt_focus_fm'],
    },
  ];

  private favorites: FavoriteRecord[] = [];

  constructor(private readonly contentService: ContentService) {}

  listPlaylists() {
    return this.playlists.map(
      ({ contentIds: _contentIds, ...playlist }) => playlist,
    );
  }

  createPlaylist(title: string, description: string) {
    const playlist: PlaylistRecord = {
      id: `pl_${Date.now().toString(36)}`,
      title,
      description,
      playlistType: 'user_created',
      itemCount: 0,
      contentIds: [],
    };

    this.playlists = [playlist, ...this.playlists];
    const { contentIds: _contentIds, ...summary } = playlist;

    return summary;
  }

  addItems(playlistId: string, contentIds: string[]) {
    const playlist = this.playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      return null;
    }

    const validIds = this.contentService
      .getByIds(contentIds)
      .map((item) => item.id);
    const nextIds = [...new Set([...playlist.contentIds, ...validIds])];
    playlist.contentIds = nextIds;
    playlist.itemCount = nextIds.length;

    return {
      playlistId,
      addedCount: validIds.length,
      itemCount: playlist.itemCount,
    };
  }

  createFavorite(input: FavoriteRecord) {
    const exists = this.favorites.some(
      (item) => item.contentId === input.contentId,
    );
    if (!exists) {
      this.favorites = [...this.favorites, input];
    }

    return {
      ...input,
      totalFavorites: this.favorites.length,
    };
  }

  removeFavorite(contentId: string) {
    const before = this.favorites.length;
    this.favorites = this.favorites.filter(
      (item) => item.contentId !== contentId,
    );

    return {
      contentId,
      removed: before !== this.favorites.length,
      totalFavorites: this.favorites.length,
    };
  }
}
