import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ContentItem as PrismaContentItem,
  ContentType as PrismaContentType,
  Prisma,
} from '@prisma/client';
import type { ContentItemDto } from '@music-ai/shared';
import { PrismaService } from '../../prisma/prisma.service';
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
  private readonly demoProviderName = 'cusic_demo';
  private catalogSyncPromise?: Promise<void>;

  constructor(
    private readonly mockContentProvider: MockContentProvider,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.ensureDemoCatalogSynced();
  }

  async search(input: SearchInput) {
    await this.ensureDemoCatalogSynced();
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
    await this.ensureDemoCatalogSynced();
    const item = await this.prisma.contentItem.findUnique({
      where: { id },
    });

    return item ? this.toContentItemDto(item) : null;
  }

  async getByIds(ids: string[]) {
    await this.ensureDemoCatalogSynced();
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
    await this.ensureDemoCatalogSynced();
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

    const item =
      this.mockContentProvider.listCatalog().find((entry) => entry.id === id) ??
      null;
    if (!item) {
      return null;
    }

    return this.upsertCatalogItem(item);
  }

  async ensureDemoCatalogSynced() {
    this.catalogSyncPromise ??= this.syncDemoCatalog();
    await this.catalogSyncPromise;
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
