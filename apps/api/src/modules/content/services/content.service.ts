import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ContentItem as PrismaContentItem,
  ContentType as PrismaContentType,
  Prisma,
} from '@prisma/client';
import type { ContentItemDto } from '@music-ai/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { JamendoContentProvider } from '../providers/jamendo-content.provider';
import type { JamendoTrackInfo } from '../providers/jamendo-content.provider';
import { MockContentProvider } from '../providers/mock-content.provider';
import type { ContentCatalogItem } from '../types/content-catalog-item.type';

type SearchInput = {
  q?: string;
  type?: string;
  language?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ContentService implements OnModuleInit {
  private readonly logger = new Logger(ContentService.name);
  private readonly demoProviderName = 'cusic_demo';
  private readonly jamendoProviderName = 'jamendo';
  private catalogSyncPromise?: Promise<void>;

  constructor(
    private readonly mockContentProvider: MockContentProvider,
    private readonly jamendoContentProvider: JamendoContentProvider,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.ensureCatalogSynced();
  }

  private async ensureCatalogSynced() {
    this.catalogSyncPromise ??= this.syncCatalog();
    await this.catalogSyncPromise;
  }

  private async syncCatalog() {
    if (this.jamendoContentProvider.isConfigured()) {
      this.logger.log('Jamendo configured — seeding catalog');
      await this.seedJamendoCatalog();
      return;
    }

    this.logger.log('Jamendo not configured — using demo catalog');
    await this.syncDemoCatalog();
  }

  private async seedJamendoCatalog() {
    try {
      const tracks = await this.jamendoContentProvider.listPopularTracks(
        100,
        0,
      );
      for (const track of tracks) {
        await this.upsertJamendoTrack(track);
      }
      this.logger.log(`Seeded ${tracks.length} Jamendo tracks`);
    } catch (error) {
      this.logger.warn(
        `Jamendo seeding failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.logger.log('Falling back to demo catalog');
      await this.syncDemoCatalog();
    }
  }

  private async upsertJamendoTrack(track: JamendoTrackInfo) {
    const contentId = `jamendo_track_${track.jamendoId}`;

    const metadata = {
      audioUrl: track.audioUrl,
      genres: track.genres ?? [],
      styles: track.styles ?? [],
      moods: track.moods ?? [],
    };

    const contentItem = await this.prisma.contentItem.upsert({
      where: { id: contentId },
      create: {
        id: contentId,
        contentType: PrismaContentType.TRACK,
        canonicalTitle: track.title,
        albumName: track.albumName,
        primaryArtistNames: [track.artistName],
        durationMs: track.durationMs,
        language: track.language,
        coverUrl: track.coverUrl,
        playable: true,
        ...(track.releaseDate
          ? { releaseDate: new Date(track.releaseDate) }
          : {}),
        metadataJson: metadata,
      },
      update: {
        canonicalTitle: track.title,
        albumName: track.albumName,
        primaryArtistNames: [track.artistName],
        durationMs: track.durationMs,
        language: track.language,
        coverUrl: track.coverUrl,
        playable: true,
        ...(track.releaseDate
          ? { releaseDate: new Date(track.releaseDate) }
          : {}),
        metadataJson: metadata,
      },
    });

    await this.prisma.contentProviderMapping.upsert({
      where: {
        providerName_providerContentId: {
          providerName: this.jamendoProviderName,
          providerContentId: track.jamendoId,
        },
      },
      create: {
        contentItemId: contentItem.id,
        providerName: this.jamendoProviderName,
        providerContentId: track.jamendoId,
        providerContentType: 'track',
        rawPayloadJson: {
          jamendoId: track.jamendoId,
          title: track.title,
          artist: track.artistName,
          album: track.albumName,
          durationMs: track.durationMs,
          audioUrl: track.audioUrl,
          coverUrl: track.coverUrl,
          releaseDate: track.releaseDate,
          genres: track.genres ?? [],
          styles: track.styles ?? [],
          moods: track.moods ?? [],
        },
        syncStatus: 'READY',
        lastSyncedAt: new Date(),
      },
      update: {
        contentItemId: contentItem.id,
        providerContentType: 'track',
        rawPayloadJson: {
          jamendoId: track.jamendoId,
          title: track.title,
          artist: track.artistName,
          album: track.albumName,
          durationMs: track.durationMs,
          audioUrl: track.audioUrl,
          coverUrl: track.coverUrl,
          releaseDate: track.releaseDate,
          genres: track.genres ?? [],
          styles: track.styles ?? [],
          moods: track.moods ?? [],
        },
        syncStatus: 'READY',
        lastSyncedAt: new Date(),
      },
    });

    return contentItem;
  }

  async search(input: SearchInput) {
    await this.ensureCatalogSynced();
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const query = input.q?.trim().toLowerCase();
    const type = this.toPrismaContentTypeFilter(input.type);
    const language = input.language?.trim().toLowerCase();

    const candidates = await this.prisma.contentItem.findMany({
      where: {
        ...(type ? { contentType: type } : {}),
        ...(language
          ? { language: { equals: language, mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const filtered = candidates.filter((item) => {
      const matchesQuery =
        !query ||
        item.canonicalTitle.toLowerCase().includes(query) ||
        item.subtitle?.toLowerCase().includes(query) ||
        item.albumName?.toLowerCase().includes(query) ||
        item.language?.toLowerCase().includes(query) ||
        item.primaryArtistNames.some((artist) =>
          artist.toLowerCase().includes(query),
        );

      return matchesQuery;
    });

    const start = (page - 1) * pageSize;
    const items = filtered
      .slice(start, start + pageSize)
      .map((item) => this.toContentItemDto(item));

    return {
      items,
      meta: {
        page,
        pageSize,
        total: filtered.length,
        hasMore: start + pageSize < filtered.length,
      },
    };
  }

  async getById(id: string) {
    await this.ensureCatalogSynced();
    const item = await this.prisma.contentItem.findUnique({
      where: { id },
    });

    return item ? this.toContentItemDto(item) : null;
  }

  async getByIds(ids: string[]) {
    await this.ensureCatalogSynced();
    const uniqueIds = [...new Set(ids)];
    const items = await this.prisma.contentItem.findMany({
      where: { id: { in: uniqueIds } },
    });
    const byId = new Map(
      items.map((item) => [item.id, this.toContentItemDto(item)]),
    );

    return ids
      .map((id) => byId.get(id) ?? null)
      .filter((item): item is ContentItemDto => item !== null);
  }

  async getRelated(id: string) {
    await this.ensureCatalogSynced();
    const source = await this.prisma.contentItem.findUnique({
      where: { id },
    });
    if (!source) {
      return [];
    }

    const items = await this.prisma.contentItem.findMany({
      where: {
        id: { not: id },
        contentType: source.contentType,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 4,
    });

    return items.map((item) => this.toContentItemDto(item));
  }

  async ensureContentItem(id: string) {
    const existing = await this.prisma.contentItem.findUnique({
      where: { id },
    });
    if (existing) {
      return existing;
    }

    if (id.startsWith('jamendo_track_')) {
      const jamendoId = id.replace('jamendo_track_', '');
      try {
        const tracks = await this.jamendoContentProvider.getTrack(jamendoId);
        if (tracks.length > 0) {
          return this.upsertJamendoTrack(tracks[0]);
        }
      } catch {
        this.logger.warn(`Unable to fetch Jamendo track ${jamendoId}`);
      }
      return null;
    }

    const item =
      this.mockContentProvider.listCatalog().find((entry) => entry.id === id) ??
      null;
    if (!item) {
      return null;
    }

    return this.upsertCatalogItem(item);
  }

  jamendoProvider(): JamendoContentProvider {
    return this.jamendoContentProvider;
  }

  async ensureDemoCatalogSynced() {
    this.catalogSyncPromise ??= this.syncDemoCatalog();
    await this.catalogSyncPromise;
  }

  async jamendoContentId(jamendoTrackId: string) {
    return `jamendo_track_${jamendoTrackId}`;
  }

  private async syncDemoCatalog() {
    for (const item of this.mockContentProvider.listCatalog()) {
      await this.upsertCatalogItem(item);
    }
  }

  private async upsertCatalogItem(item: ContentCatalogItem) {
    const contentItem = await this.prisma.contentItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        contentType: this.toPrismaContentType(item.type),
        canonicalTitle: item.title,
        albumName: item.album,
        primaryArtistNames: item.artists,
        durationMs: item.durationMs,
        language: item.language,
        coverUrl: item.coverUrl,
        playable: item.playable ?? true,
        metadataJson: this.toMetadataJson(item),
      },
      update: {
        contentType: this.toPrismaContentType(item.type),
        canonicalTitle: item.title,
        albumName: item.album,
        primaryArtistNames: item.artists,
        durationMs: item.durationMs,
        language: item.language,
        coverUrl: item.coverUrl,
        playable: item.playable ?? true,
        metadataJson: this.toMetadataJson(item),
      },
    });

    await this.prisma.contentProviderMapping.upsert({
      where: {
        providerName_providerContentId: {
          providerName: this.demoProviderName,
          providerContentId: item.id,
        },
      },
      create: {
        contentItemId: contentItem.id,
        providerName: this.demoProviderName,
        providerContentId: item.id,
        providerContentType: item.type,
        rawPayloadJson: this.toRawPayloadJson(item),
        syncStatus: 'READY',
        lastSyncedAt: new Date(),
      },
      update: {
        contentItemId: contentItem.id,
        providerContentType: item.type,
        rawPayloadJson: this.toRawPayloadJson(item),
        syncStatus: 'READY',
        lastSyncedAt: new Date(),
      },
    });

    return contentItem;
  }

  toContentItemDto(item: PrismaContentItem): ContentItemDto {
    const metadata =
      item.metadataJson &&
      typeof item.metadataJson === 'object' &&
      !Array.isArray(item.metadataJson)
        ? item.metadataJson
        : {};
    const audioUrl =
      'audioUrl' in metadata && typeof metadata.audioUrl === 'string'
        ? metadata.audioUrl
        : null;

    return {
      id: item.id,
      type: this.fromPrismaContentType(item.contentType),
      title: item.canonicalTitle,
      artists: item.primaryArtistNames,
      album: item.albumName,
      durationMs: item.durationMs,
      language: item.language,
      coverUrl: item.coverUrl,
      audioUrl,
      playable: item.playable,
    };
  }

  private toMetadataJson(item: ContentCatalogItem): Prisma.InputJsonObject {
    return {
      audioUrl: item.audioUrl ?? null,
    };
  }

  private toRawPayloadJson(item: ContentCatalogItem): Prisma.InputJsonObject {
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      artists: item.artists,
      album: item.album ?? null,
      durationMs: item.durationMs ?? null,
      language: item.language ?? null,
      coverUrl: item.coverUrl ?? null,
      audioUrl: item.audioUrl ?? null,
      playable: item.playable ?? true,
    };
  }

  private toPrismaContentType(type: ContentCatalogItem['type']) {
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

  private toPrismaContentTypeFilter(type?: string) {
    switch (type?.trim().toLowerCase()) {
      case 'podcast':
        return PrismaContentType.PODCAST_EPISODE;
      case 'radio':
        return PrismaContentType.RADIO_STREAM;
      case 'album':
        return PrismaContentType.ALBUM;
      case 'track':
        return PrismaContentType.TRACK;
      default:
        return null;
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
}
