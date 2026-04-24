import { Injectable } from '@nestjs/common';
import { ContentType as PrismaContentType } from '@prisma/client';
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
export class ContentService {
  constructor(
    private readonly mockContentProvider: MockContentProvider,
    private readonly prisma: PrismaService,
  ) {}

  search(input: SearchInput) {
    const catalog = this.mockContentProvider.listCatalog();
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const query = input.q?.trim().toLowerCase();
    const type = input.type?.trim().toLowerCase();
    const language = input.language?.trim().toLowerCase();

    const filtered = catalog.filter((item) => {
      const matchesQuery =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.artists.some((artist) => artist.toLowerCase().includes(query)) ||
        item.album?.toLowerCase().includes(query);
      const matchesType = !type || item.type === type;
      const matchesLanguage =
        !language || item.language?.toLowerCase() === language;

      return matchesQuery && matchesType && matchesLanguage;
    });

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

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

  getById(id: string) {
    return (
      this.mockContentProvider.listCatalog().find((item) => item.id === id) ??
      null
    );
  }

  getByIds(ids: string[]) {
    return ids
      .map((id) => this.getById(id))
      .filter((item): item is ContentCatalogItem => item !== null);
  }

  getRelated(id: string) {
    const source = this.getById(id);
    if (!source) {
      return [];
    }

    return this.mockContentProvider
      .listCatalog()
      .filter((item) => item.id !== id && item.type === source.type)
      .slice(0, 4);
  }

  async ensureContentItem(id: string) {
    const item = this.getById(id);
    if (!item) {
      return null;
    }

    return this.prisma.contentItem.upsert({
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
        metadataJson: item.audioUrl ? { audioUrl: item.audioUrl } : undefined,
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
        metadataJson: item.audioUrl ? { audioUrl: item.audioUrl } : undefined,
      },
    });
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
}
