import { Injectable } from '@nestjs/common';
import type {
  PlaylistDeleteResponseDto,
  PlaylistDetailDto,
  PlaylistItemRemovalResponseDto,
  PlaylistItemsAppendResponseDto,
  PlaylistItemDto,
  PlaylistSummaryDto,
  PlaylistUpdateResponseDto,
  UpdatePlaylistDto,
} from '@music-ai/shared';
import {
  ContentType as PrismaContentType,
  PlaylistType,
  Prisma,
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
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      return playlists.map((playlist) =>
        this.toPlaylistSummary({
          id: playlist.id,
          title: playlist.title,
          description: playlist.description ?? '',
          playlistType: this.fromPrismaPlaylistType(playlist.playlistType),
          itemCount: playlist._count.items,
        }),
      );
    }

    return this.playlists.map(({ contentIds: _contentIds, ...playlist }) =>
      this.toPlaylistSummary(playlist),
    );
  }

  async getPlaylistDetail(
    playlistId: string,
    userId?: string,
  ): Promise<PlaylistDetailDto | null> {
    if (userId) {
      const playlist = await this.prisma.playlist.findFirst({
        where: {
          id: playlistId,
          userId,
          deletedAt: null,
        },
        include: {
          items: {
            orderBy: { position: 'asc' },
            include: { contentItem: true },
          },
          _count: {
            select: { items: true },
          },
        },
      });

      if (!playlist) {
        return null;
      }

      return {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description ?? '',
        playlistType: this.fromPrismaPlaylistType(playlist.playlistType),
        itemCount: playlist._count.items,
        items: playlist.items.map((item) => ({
          position: item.position,
          content: this.contentService.toContentItemDto(item.contentItem),
        })),
      };
    }

    const playlist = this.playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      return null;
    }

    return this.toDemoPlaylistDetail(playlist);
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

      return this.toPlaylistSummary({
        id: playlist.id,
        title: playlist.title,
        description: playlist.description ?? '',
        playlistType: this.fromPrismaPlaylistType(playlist.playlistType),
        itemCount: playlist._count.items,
      });
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

    return this.toPlaylistSummary(summary);
  }

  async createAiGeneratedPlaylist(
    input: {
      title: string;
      description: string;
      contentIds: string[];
      generatedContext?: Record<string, unknown>;
      reasonText?: string;
    },
    userId: string,
  ): Promise<PlaylistSummaryDto> {
    const uniqueIds = [...new Set(input.contentIds)];
    const validIds: string[] = [];

    for (const contentId of uniqueIds) {
      const contentItem =
        await this.contentService.ensureContentItem(contentId);
      if (contentItem) {
        validIds.push(contentItem.id);
      }
    }

    const playlist = await this.prisma.$transaction(async (tx) => {
      const created = await tx.playlist.create({
        data: {
          userId,
          title: input.title,
          description: input.description,
          playlistType: PlaylistType.AI_GENERATED,
          sourceType: SourceType.AI,
          generatedContextJson: input.generatedContext as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      for (const [index, contentItemId] of validIds.entries()) {
        await tx.playlistItem.create({
          data: {
            playlistId: created.id,
            contentItemId,
            position: index + 1,
            addedByType: SourceType.AI,
            reasonText: input.reasonText,
          },
        });
      }

      return created;
    });

    return this.toPlaylistSummary({
      id: playlist.id,
      title: playlist.title,
      description: playlist.description ?? '',
      playlistType: this.fromPrismaPlaylistType(playlist.playlistType),
      itemCount: validIds.length,
    });
  }

  async updatePlaylist(
    playlistId: string,
    input: UpdatePlaylistDto,
    userId?: string,
  ): Promise<PlaylistUpdateResponseDto> {
    if (userId) {
      const existing = await this.getPlaylistDetail(playlistId, userId);
      if (!existing) {
        return {
          updated: false,
          playlist: null,
        };
      }

      if (input.title === undefined && input.description === undefined) {
        return {
          updated: false,
          playlist: existing,
        };
      }

      const playlist = await this.prisma.playlist.update({
        where: { id: playlistId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
        },
        include: {
          items: {
            orderBy: { position: 'asc' },
            include: { contentItem: true },
          },
          _count: {
            select: { items: true },
          },
        },
      });

      return {
        updated: true,
        playlist: {
          id: playlist.id,
          title: playlist.title,
          description: playlist.description ?? '',
          playlistType: this.fromPrismaPlaylistType(playlist.playlistType),
          itemCount: playlist._count.items,
          items: playlist.items.map((item) => ({
            position: item.position,
            content: this.contentService.toContentItemDto(item.contentItem),
          })),
        },
      };
    }

    const playlist = this.playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      return {
        updated: false,
        playlist: null,
      };
    }

    if (input.title === undefined && input.description === undefined) {
      return {
        updated: false,
        playlist: await this.toDemoPlaylistDetail(playlist),
      };
    }

    if (input.title !== undefined) {
      playlist.title = input.title;
    }
    if (input.description !== undefined) {
      playlist.description = input.description;
    }

    return {
      updated: true,
      playlist: await this.toDemoPlaylistDetail(playlist),
    };
  }

  async deletePlaylist(
    playlistId: string,
    userId?: string,
  ): Promise<PlaylistDeleteResponseDto> {
    if (userId) {
      const result = await this.prisma.playlist.updateMany({
        where: {
          id: playlistId,
          userId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        playlistId,
        deleted: result.count > 0,
      };
    }

    const before = this.playlists.length;
    this.playlists = this.playlists.filter((item) => item.id !== playlistId);

    return {
      playlistId,
      deleted: before !== this.playlists.length,
    };
  }

  async addItems(
    playlistId: string,
    contentIds: string[],
    userId?: string,
  ): Promise<PlaylistItemsAppendResponseDto | null> {
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
        const contentItem =
          await this.contentService.ensureContentItem(contentId);
        if (contentItem) {
          validIds.push(contentItem.id);
        }
      }

      const lastItem = await this.prisma.playlistItem.findFirst({
        where: { playlistId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const itemCount = await this.prisma.$transaction(async (tx) => {
        if (validIds.length > 0) {
          let position = lastItem?.position ?? 0;
          for (const contentItemId of validIds) {
            await tx.playlistItem.create({
              data: {
                playlistId,
                contentItemId,
                position: ++position,
                addedByType: SourceType.USER,
              },
            });
          }
          await tx.playlist.update({
            where: { id: playlistId },
            data: {
              updatedAt: new Date(),
            },
          });
        }

        return tx.playlistItem.count({
          where: { playlistId },
        });
      });

      return {
        playlistId,
        addedCount: validIds.length,
        skippedCount: uniqueIds.length - validIds.length,
        itemCount,
      };
    }

    const playlist = this.playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      return null;
    }

    const uniqueIds = [...new Set(contentIds)];
    const validIds = (await this.contentService.getByIds(uniqueIds)).map(
      (item) => item.id,
    );
    const nextIds = [...new Set([...playlist.contentIds, ...validIds])];
    const addedCount = nextIds.length - playlist.contentIds.length;
    playlist.contentIds = nextIds;
    playlist.itemCount = nextIds.length;

    return {
      playlistId,
      addedCount,
      skippedCount: uniqueIds.length - addedCount,
      itemCount: playlist.itemCount,
    };
  }

  async removeItem(
    playlistId: string,
    contentId: string,
    userId?: string,
  ): Promise<PlaylistItemRemovalResponseDto> {
    if (userId) {
      const playlist = await this.prisma.playlist.findFirst({
        where: {
          id: playlistId,
          userId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!playlist) {
        return {
          playlistId,
          contentId,
          removed: false,
          itemCount: 0,
        };
      }

      const existing = await this.prisma.playlistItem.findFirst({
        where: {
          playlistId,
          contentItemId: contentId,
        },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });

      if (!existing) {
        return {
          playlistId,
          contentId,
          removed: false,
          itemCount: await this.prisma.playlistItem.count({
            where: { playlistId },
          }),
        };
      }

      const itemCount = await this.prisma.$transaction(async (tx) => {
        await tx.playlistItem.delete({
          where: { id: existing.id },
        });
        await tx.playlistItem.updateMany({
          where: {
            playlistId,
            position: {
              gt: existing.position,
            },
          },
          data: {
            position: {
              decrement: 1,
            },
          },
        });
        await tx.playlist.update({
          where: { id: playlistId },
          data: {
            updatedAt: new Date(),
          },
        });

        return tx.playlistItem.count({
          where: { playlistId },
        });
      });

      return {
        playlistId,
        contentId,
        removed: true,
        itemCount,
      };
    }

    const playlist = this.playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      return {
        playlistId,
        contentId,
        removed: false,
        itemCount: 0,
      };
    }

    const before = playlist.contentIds.length;
    playlist.contentIds = playlist.contentIds.filter((id) => id !== contentId);
    playlist.itemCount = playlist.contentIds.length;

    return {
      playlistId,
      contentId,
      removed: before !== playlist.contentIds.length,
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

  private toPlaylistSummary(playlist: PlaylistSummaryDto): PlaylistSummaryDto {
    return {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      playlistType: playlist.playlistType,
      itemCount: playlist.itemCount,
    };
  }

  private async toDemoPlaylistDetail(
    playlist: PlaylistRecord,
  ): Promise<PlaylistDetailDto> {
    const items = await this.contentService.getByIds(playlist.contentIds);

    return {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      playlistType: playlist.playlistType,
      itemCount: items.length,
      items: items.map(
        (content, index): PlaylistItemDto => ({
          position: index + 1,
          content,
        }),
      ),
    };
  }
}
