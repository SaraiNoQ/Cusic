import { Injectable } from '@nestjs/common';

interface JamendoTrackResult {
  id: string;
  name: string;
  artist_name: string;
  album_name: string;
  duration: number;
  audio: string;
  image: string;
  releasedate?: string;
  shorturl?: string;
  shareurl?: string;
  license_ccurl?: string;
  musicinfo?: {
    tags?: {
      genres?: string[];
      styles?: string[];
      moods?: string[];
    };
  };
}

interface JamendoHeaders {
  status: string;
  code: number;
  error_message?: string;
  results_count: number;
  results_fullcount?: number;
}

interface JamendoResponse<T> {
  headers: JamendoHeaders;
  results: T[];
}

export interface JamendoTrackInfo {
  jamendoId: string;
  title: string;
  artistName: string;
  albumName: string;
  durationMs: number;
  audioUrl: string;
  coverUrl: string;
  language: string;
  releaseDate: string | null;
  genres?: string[];
  styles?: string[];
  moods?: string[];
}

@Injectable()
export class JamendoContentProvider {
  private readonly baseUrl = 'https://api.jamendo.com/v3.0';

  isConfigured(): boolean {
    return Boolean(this.getClientId());
  }

  async listPopularTracks(limit = 100, offset = 0) {
    return this.jamendoFetch<JamendoTrackResult>('/tracks', {
      limit: String(limit),
      offset: String(offset),
      order: 'popularity_total',
      include: 'musicinfo',
    });
  }

  async searchTracks(query: string, limit = 20, offset = 0) {
    return this.jamendoFetch<JamendoTrackResult>('/tracks', {
      search: query,
      limit: String(limit),
      offset: String(offset),
      include: 'musicinfo',
    });
  }

  async getTrack(jamendoId: string) {
    return this.jamendoFetch<JamendoTrackResult>('/tracks', {
      id: jamendoId,
      include: 'musicinfo',
    });
  }

  async getPlaylistTracks(playlistId: number) {
    return this.jamendoFetch<JamendoTrackResult>('/playlists/tracks', {
      id: String(playlistId),
      include: 'musicinfo',
    });
  }

  async getAlbumTracks(albumId: number) {
    return this.jamendoFetch<JamendoTrackResult>('/albums/tracks', {
      id: String(albumId),
      include: 'musicinfo',
    });
  }

  mapToTrackInfo(track: JamendoTrackResult): JamendoTrackInfo {
    const lang = this.inferLanguage(track.name, track.artist_name);
    const tags = track.musicinfo?.tags;

    return {
      jamendoId: track.id,
      title: track.name,
      artistName: track.artist_name,
      albumName: track.album_name,
      durationMs: Math.round(track.duration * 1000),
      audioUrl: track.audio,
      coverUrl: track.image || (null as unknown as string),
      language: lang,
      releaseDate: track.releasedate ?? null,
      genres: tags?.genres ?? [],
      styles: tags?.styles ?? [],
      moods: tags?.moods ?? [],
    };
  }

  private inferLanguage(title: string, artistName: string): string {
    const combined = `${title} ${artistName}`;
    const hasChineseChar = /[\u4e00-\u9fff]/.test(combined);
    if (hasChineseChar) {
      return 'zh';
    }

    const hasJapaneseChar = /[\u3040-\u309f\u30a0-\u30ff]/.test(combined);
    if (hasJapaneseChar) {
      return 'ja';
    }

    const hasKoreanChar = /[\uac00-\ud7af]/.test(combined);
    if (hasKoreanChar) {
      return 'ko';
    }

    const hasCyrillic = /[а-яА-Я]/.test(combined);
    if (hasCyrillic) {
      return 'ru';
    }

    return 'en';
  }

  private getClientId(): string | undefined {
    const clientId = process.env.JAMENDO_CLIENT_ID?.trim();
    if (!clientId || clientId === 'replace-me') {
      return undefined;
    }
    return clientId;
  }

  private async jamendoFetch<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<JamendoTrackInfo[]> {
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

    const data = (await response.json()) as JamendoResponse<T>;

    if (data.headers.status !== 'success') {
      throw new Error(
        `Jamendo API error: ${data.headers.error_message ?? 'unknown error'}`,
      );
    }

    return data.results.map((item) =>
      this.mapToTrackInfo(item as unknown as JamendoTrackResult),
    );
  }
}
