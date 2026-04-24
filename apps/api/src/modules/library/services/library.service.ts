import { Injectable } from '@nestjs/common';
import {
  ContentType as PrismaContentType,
  PlaylistType,
  SourceType,
} from '@prisma/client';
import { ContentService } from '../../content/services/content.service';
import { PrismaService } from '../../prisma/prisma.service';
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

  constructor(
    private readonly contentService: ContentService,
    private readonly prisma: PrismaService,
  ) {}

  async listPlaylists(userId?: string) {
    if (userId) {
      await this.ensureDefaultPlaylist(userId);
      const playlists = await this.prisma.playlist.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      return playlists.map((playlist) => ({
        id: playlist.id,
        title: playlist.title,
        description: playlist.description ?? '',
        playlistType: this.fromPrismaPlaylistType(playlist.playlistType),
        itemCount: playlist._count.items,
      }));
    }

    return this.playlists.map(
      ({ contentIds: _contentIds, ...playlist }) => playlist,
    );
  }

  async createPlaylist(title: string, description: string, userId?: string) {
    if (userId) {
      const playlist = await this.prisma.playlist.create({
        data: {
          userId,
          title,
          description,
          playlistType: PlaylistType.USER_CREATED,
          sourceType: SourceType.USER,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      return {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description ?? '',
        playlistType: this.fromPrismaPlaylistType(playlist.playlistType),
        itemCount: playlist._count.items,
      };
    }

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

  async addItems(playlistId: string, contentIds: string[], userId?: string) {
    if (userId) {
      const playlist = await this.prisma.playlist.findFirst({
        where: {
          id: playlistId,
          userId,
          deletedAt: null,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });
      if (!playlist) {
        return null;
      }

      const uniqueIds = [...new Set(contentIds)];
      const existingItems = await this.prisma.playlistItem.findMany({
        where: {
          playlistId,
          contentItemId: { in: uniqueIds },
        },
        select: { contentItemId: true },
      });
      const existingIds = new Set(
        existingItems.map((item) => item.contentItemId),
      );
      const validIds: string[] = [];
      for (const contentId of uniqueIds) {
        if (existingIds.has(contentId)) {
          continue;
        }
        const contentItem = await this.contentService.ensureContentItem(
          contentId,
        );
        if (contentItem) {
          validIds.push(contentItem.id);
        }
      }

      const lastItem = await this.prisma.playlistItem.findFirst({
        where: { playlistId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      let position = lastItem?.position ?? 0;
      await this.prisma.$transaction(
        validIds.map((contentItemId) =>
          this.prisma.playlistItem.create({
            data: {
              playlistId,
              contentItemId,
              position: ++position,
              addedByType: SourceType.USER,
            },
          }),
        ),
      );

      const itemCount = await this.prisma.playlistItem.count({
        where: { playlistId },
      });

      return {
        playlistId,
        addedCount: validIds.length,
        itemCount,
      };
    }

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

  async listFavorites(userId?: string) {
    if (userId) {
      const favorites = await this.prisma.favorite.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      return favorites.map((favorite) => ({
        contentId: favorite.contentItemId,
        favoriteType: this.fromPrismaContentType(favorite.favoriteType),
      }));
    }

    return this.favorites;
  }

  async createFavorite(input: FavoriteRecord, userId?: string) {
    if (userId) {
      const contentItem = await this.contentService.ensureContentItem(
        input.contentId,
      );
      if (!contentItem) {
        return {
          ...input,
          totalFavorites: await this.countFavorites(userId),
        };
      }

      const existing = await this.prisma.favorite.findFirst({
        where: {
          userId,
          contentItemId: contentItem.id,
          favoriteType: this.toPrismaContentType(input.favoriteType),
        },
      });

      if (existing) {
        await this.prisma.favorite.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
      } else {
        await this.prisma.favorite.create({
          data: {
            userId,
            contentItemId: contentItem.id,
            favoriteType: this.toPrismaContentType(input.favoriteType),
          },
        });
      }

      return {
        ...input,
        totalFavorites: await this.countFavorites(userId),
      };
    }

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

  async removeFavorite(contentId: string, userId?: string) {
    if (userId) {
      const result = await this.prisma.favorite.updateMany({
        where: {
          userId,
          contentItemId: contentId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        contentId,
        removed: result.count > 0,
        totalFavorites: await this.countFavorites(userId),
      };
    }

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

  private async ensureDefaultPlaylist(userId: string) {
    const existing = await this.prisma.playlist.findFirst({
      where: {
        userId,
        playlistType: PlaylistType.DAILY,
        sourceType: SourceType.SYSTEM,
        deletedAt: null,
      },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.playlist.create({
      data: {
        userId,
        title: 'Cusic',
        description: 'Default Cusic listening lane.',
        playlistType: PlaylistType.DAILY,
        sourceType: SourceType.SYSTEM,
        isPinned: true,
      },
    });
  }

  private countFavorites(userId: string) {
    return this.prisma.favorite.count({
      where: {
        userId,
        deletedAt: null,
      },
    });
  }

  private toPrismaContentType(type: FavoriteRecord['favoriteType']) {
    switch (type) {
      case 'podcast':
        return PrismaContentType.PODCAST_EPISODE;
      case 'radio':
        return PrismaContentType.RADIO_STREAM;
      case 'album':
        return PrismaContentType.ALBUM;
      case 'track':
      default:
        return PrismaContentType.TRACK;
    }
  }

  private fromPrismaContentType(type: PrismaContentType) {
    switch (type) {
      case PrismaContentType.PODCAST_EPISODE:
        return 'podcast';
      case PrismaContentType.RADIO_STREAM:
        return 'radio';
      case PrismaContentType.ALBUM:
        return 'album';
      case PrismaContentType.TRACK:
      default:
        return 'track';
    }
  }

  private fromPrismaPlaylistType(type: PlaylistType) {
    switch (type) {
      case PlaylistType.AI_GENERATED:
        return 'ai_generated';
      case PlaylistType.DAILY:
        return 'daily';
      case PlaylistType.IMPORTED:
        return 'imported';
      case PlaylistType.USER_CREATED:
      default:
        return 'user_created';
    }
  }
}
