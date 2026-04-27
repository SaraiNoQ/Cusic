import { Injectable, Logger } from '@nestjs/common';
import {
  ContentType as PrismaContentType,
  PlaylistType,
  SourceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ImportParams,
  ImportProvider,
  ImportResult,
} from './import-provider.interface';

@Injectable()
export class JamendoImportProvider implements ImportProvider {
  readonly name = 'jamendo';
  private readonly logger = new Logger(JamendoImportProvider.name);
  private readonly baseUrl = 'https://api.jamendo.com/v3.0';

  constructor(private readonly prisma: PrismaService) {}

  validatePayload(payload: Record<string, unknown>): {
    valid: boolean;
    error?: string;
  } {
    const playlistId = payload.playlistId;
    const albumId = payload.albumId;

    if (playlistId !== undefined && typeof playlistId === 'number') {
      return { valid: true };
    }

    if (albumId !== undefined && typeof albumId === 'number') {
      return { valid: true };
    }

    return {
      valid: false,
      error:
        'Payload must include either playlistId (number) or albumId (number) for Jamendo imports.',
    };
  }

  async executeImport(params: ImportParams): Promise<ImportResult> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error('Jamendo client_id is not configured');
    }

    const playlistId = params.payload.playlistId as number | undefined;
    const albumId = params.payload.albumId as number | undefined;

    let rawTracks: RawJamendoTrack[];

    if (playlistId !== undefined) {
      rawTracks = await this.fetchPlaylistTracks(playlistId);
    } else if (albumId !== undefined) {
      rawTracks = await this.fetchAlbumTracks(albumId);
    } else {
      throw new Error('Import payload must include playlistId or albumId');
    }

    if (rawTracks.length === 0) {
      return {
        importedItemCount: 0,
        playlistCount: 0,
        summaryText:
          'No tracks were found for the given Jamendo playlist or album.',
        warnings: ['Empty source'],
      };
    }

    const sourceLabel =
      playlistId !== undefined
        ? `Jamendo playlist #${playlistId}`
        : `Jamendo album #${albumId}`;

    const contentItems = await this.upsertJamendoTracks(rawTracks);
    const playlist = await this.createImportedPlaylist(
      params.userId,
      sourceLabel,
      contentItems,
    );

    this.logger.log(
      `Imported ${contentItems.length} tracks into playlist ${playlist.id}`,
    );

    return {
      importedItemCount: contentItems.length,
      playlistCount: 1,
      summaryText: `Imported ${contentItems.length} tracks from ${sourceLabel} and saved as the playlist "${playlist.title}".`,
      warnings: [],
    };
  }

  private async fetchPlaylistTracks(playlistId: number) {
    return this.jamendoFetch<RawJamendoTrack>('/playlists/tracks', {
      id: String(playlistId),
      include: 'musicinfo',
    });
  }

  private async fetchAlbumTracks(albumId: number) {
    return this.jamendoFetch<RawJamendoTrack>('/albums/tracks', {
      id: String(albumId),
      include: 'musicinfo',
    });
  }

  private async upsertJamendoTracks(rawTracks: RawJamendoTrack[]) {
    const contentIds: string[] = [];

    for (const track of rawTracks) {
      const contentId = `jamendo_track_${track.id}`;
      const lang = this.inferLanguage(track.name, track.artist_name);

      await this.prisma.contentItem.upsert({
        where: { id: contentId },
        create: {
          id: contentId,
          contentType: PrismaContentType.TRACK,
          canonicalTitle: track.name,
          albumName: track.album_name,
          primaryArtistNames: [track.artist_name],
          durationMs: Math.round(track.duration * 1000),
          language: lang,
          coverUrl: track.image,
          playable: true,
          metadataJson: { audioUrl: track.audio },
        },
        update: {
          canonicalTitle: track.name,
          albumName: track.album_name,
          primaryArtistNames: [track.artist_name],
          durationMs: Math.round(track.duration * 1000),
          language: lang,
          coverUrl: track.image,
          playable: true,
          metadataJson: { audioUrl: track.audio },
        },
      });

      await this.prisma.contentProviderMapping.upsert({
        where: {
          providerName_providerContentId: {
            providerName: 'jamendo',
            providerContentId: track.id,
          },
        },
        create: {
          contentItemId: contentId,
          providerName: 'jamendo',
          providerContentId: track.id,
          providerContentType: 'track',
          rawPayloadJson: track as unknown as Prisma.InputJsonObject,
          syncStatus: 'READY',
          lastSyncedAt: new Date(),
        },
        update: {
          contentItemId: contentId,
          providerContentType: 'track',
          rawPayloadJson: track as unknown as Prisma.InputJsonObject,
          syncStatus: 'READY',
          lastSyncedAt: new Date(),
        },
      });

      contentIds.push(contentId);
    }

    return contentIds;
  }

  private async createImportedPlaylist(
    userId: string,
    sourceLabel: string,
    contentIds: string[],
  ) {
    const playlist = await this.prisma.playlist.create({
      data: {
        userId,
        title: `Jamendo Import — ${sourceLabel}`,
        description: `Tracks imported from ${sourceLabel} via the Jamendo API.`,
        playlistType: PlaylistType.IMPORTED,
        sourceType: SourceType.IMPORT,
        generatedContextJson: {
          source: 'jamendo',
          sourceLabel,
          importedAt: new Date().toISOString(),
        },
      },
    });

    for (let position = 0; position < contentIds.length; position++) {
      await this.prisma.playlistItem.create({
        data: {
          playlistId: playlist.id,
          contentItemId: contentIds[position],
          position: position + 1,
          addedByType: SourceType.IMPORT,
          reasonText: `Imported from ${sourceLabel}`,
        },
      });
    }

    return playlist;
  }

  private getClientId(): string | undefined {
    const clientId = process.env.JAMENDO_CLIENT_ID?.trim();
    if (!clientId || clientId === 'replace-me') {
      return undefined;
    }
    return clientId;
  }

  private inferLanguage(title: string, artistName: string): string {
    const combined = `${title} ${artistName}`;
    if (/[\u4e00-\u9fff]/.test(combined)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(combined)) return 'ja';
    if (/[\uac00-\ud7af]/.test(combined)) return 'ko';
    if (/[а-яА-Я]/.test(combined)) return 'ru';
    return 'en';
  }

  private async jamendoFetch<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T[]> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error('Jamendo client_id is not configured');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('format', 'json');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Jamendo API returned ${response.status}: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      headers: { status: string; error_message?: string };
      results: T[];
    };

    if (data.headers.status !== 'success') {
      throw new Error(
        `Jamendo API error: ${data.headers.error_message ?? 'unknown error'}`,
      );
    }

    return data.results;
  }
}

interface RawJamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  album_name: string;
  duration: number;
  audio: string;
  image: string;
  releasedate?: string;
}
