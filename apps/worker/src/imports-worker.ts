import {
  ContentType,
  JobStatus,
  JobType,
  PlaylistType,
  Prisma,
  PrismaClient,
  SourceType,
} from '@prisma/client';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';

type ImportQueueJobData = {
  jobId: string;
};

type ImportJobResultSummaryDto = {
  mode: 'baseline_stub' | 'worker_stub' | 'provider_live';
  phase: 'accepted' | 'running' | 'completed' | 'failed';
  accepted?: boolean;
  importType?: 'playlist' | 'history';
  providerName?: string;
  summaryText?: string;
  importedItemCount?: number;
  playlistCount?: number;
  historyItemCount?: number;
  warnings?: string[];
};

const importsQueueName =
  process.env.IMPORTS_QUEUE_NAME?.trim() || 'music-ai-imports';

const jamendoBaseUrl = 'https://api.jamendo.com/v3.0';

// ─── Redis ───────────────────────────────────────────────────────────────────

function createRedisConnection() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error('REDIS_URL is not configured');
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

function log(status: string, extra?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      service: 'worker',
      lane: 'imports',
      queueName: importsQueueName,
      status,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
  );
}

// ─── Jamendo helpers ─────────────────────────────────────────────────────────

function getJamendoClientId(): string | undefined {
  const clientId = process.env.JAMENDO_CLIENT_ID?.trim();
  if (!clientId || clientId === 'replace-me') {
    return undefined;
  }
  return clientId;
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

interface JamendoResponse<T> {
  headers: { status: string; error_message?: string; results_count: number };
  results: T[];
}

function inferLanguage(title: string, artistName: string): string {
  const combined = `${title} ${artistName}`;
  if (/[\u4e00-\u9fff]/.test(combined)) return 'zh';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(combined)) return 'ja';
  if (/[\uac00-\ud7af]/.test(combined)) return 'ko';
  if (/[а-яА-Я]/.test(combined)) return 'ru';
  return 'en';
}

async function jamendoFetch<T>(
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const clientId = getJamendoClientId();
  if (!clientId) {
    throw new Error('Jamendo client_id is not configured');
  }

  const url = new URL(`${jamendoBaseUrl}${path}`);
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

  return data.results;
}

async function executeJamendoImport(
  prisma: PrismaClient,
  jobId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<ImportJobResultSummaryDto> {
  const clientId = getJamendoClientId();
  if (!clientId) {
    throw new Error(
      'Jamendo client_id is not configured. Set JAMENDO_CLIENT_ID in .env.',
    );
  }

  const playlistId = payload.playlistId as number | undefined;
  const albumId = payload.albumId as number | undefined;

  let rawTracks: RawJamendoTrack[];

  if (playlistId !== undefined) {
    rawTracks = await jamendoFetch<RawJamendoTrack>('/playlists/tracks', {
      id: String(playlistId),
      include: 'musicinfo',
    });
  } else if (albumId !== undefined) {
    rawTracks = await jamendoFetch<RawJamendoTrack>('/albums/tracks', {
      id: String(albumId),
      include: 'musicinfo',
    });
  } else {
    throw new Error(
      'Payload must include playlistId (number) or albumId (number)',
    );
  }

  if (rawTracks.length === 0) {
    return {
      mode: 'provider_live',
      phase: 'completed',
      importType: 'playlist',
      providerName: 'jamendo',
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

  const contentIds: string[] = [];

  for (const track of rawTracks) {
    const contentId = `jamendo_track_${track.id}`;
    const lang = inferLanguage(track.name, track.artist_name);

    await prisma.contentItem.upsert({
      where: { id: contentId },
      create: {
        id: contentId,
        contentType: ContentType.TRACK,
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

    await prisma.contentProviderMapping.upsert({
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

  const playlist = await prisma.playlist.create({
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
    await prisma.playlistItem.create({
      data: {
        playlistId: playlist.id,
        contentItemId: contentIds[position],
        position: position + 1,
        addedByType: SourceType.IMPORT,
        reasonText: `Imported from ${sourceLabel}`,
      },
    });
  }

  log('jamendo_import_succeeded', {
    jobId,
    trackCount: contentIds.length,
    playlistId: playlist.id,
  });

  return {
    mode: 'provider_live',
    phase: 'completed',
    importType: 'playlist',
    providerName: 'jamendo',
    importedItemCount: contentIds.length,
    playlistCount: 1,
    summaryText: `Imported ${contentIds.length} tracks from ${sourceLabel} and saved as the playlist "${playlist.title}".`,
    warnings: [],
  };
}

function buildStubSummary(jobType: JobType): ImportJobResultSummaryDto {
  if (jobType === JobType.HISTORY_IMPORT) {
    return {
      mode: 'worker_stub',
      phase: 'completed',
      importType: 'history',
      historyItemCount: 18,
      importedItemCount: 18,
      summaryText:
        'Worker completed the baseline history import and normalized 18 listening records.',
      warnings: [
        'This is still a stub executor; no third-party provider data was fetched yet.',
      ],
    };
  }

  return {
    mode: 'worker_stub',
    phase: 'completed',
    importType: 'playlist',
    playlistCount: 1,
    importedItemCount: 12,
    summaryText:
      'Worker completed the baseline playlist import and staged 12 playlist items for later provider mapping.',
    warnings: [
      'This is still a stub executor; no third-party provider data was fetched yet.',
    ],
  };
}

// ─── Worker ──────────────────────────────────────────────────────────────────

export function createImportsWorker(prisma: PrismaClient) {
  const connection = createRedisConnection();
  const concurrency = Number.parseInt(
    process.env.WORKER_IMPORTS_CONCURRENCY ?? '1',
    10,
  );

  const worker = new Worker<ImportQueueJobData>(
    importsQueueName,
    async (job) => {
      const startedAt = new Date();
      const running = await prisma.importJob.updateMany({
        where: {
          id: job.data.jobId,
          jobStatus: JobStatus.QUEUED,
        },
        data: {
          jobStatus: JobStatus.RUNNING,
          startedAt,
          finishedAt: null,
          errorText: null,
          resultSummaryJson: toJsonSummary({
            mode: 'worker_stub',
            phase: 'running',
            summaryText: 'Worker accepted the import job and is processing it.',
          }),
        },
      });

      if (running.count === 0) {
        log('skip_nonqueued_job', { jobId: job.data.jobId });
        return {
          jobId: job.data.jobId,
          skipped: true,
        };
      }

      const importJob = await prisma.importJob.findUnique({
        where: {
          id: job.data.jobId,
        },
      });

      if (!importJob) {
        throw new Error(`Import job ${job.data.jobId} was not found`);
      }

      const providerName =
        importJob.providerName?.trim().toLowerCase() ?? 'unknown';
      const payload = (importJob.inputPayloadJson ?? {}) as Record<
        string,
        unknown
      >;

      let resultSummary: ImportJobResultSummaryDto;

      if (providerName === 'jamendo' && getJamendoClientId()) {
        resultSummary = await executeJamendoImport(
          prisma,
          importJob.id,
          importJob.userId,
          payload,
        );
      } else if (providerName === 'jamendo' && !getJamendoClientId()) {
        throw new Error(
          'Jamendo client_id is not configured. Set JAMENDO_CLIENT_ID in .env to import from Jamendo.',
        );
      } else {
        resultSummary = buildStubSummary(importJob.jobType);
        resultSummary = {
          ...resultSummary,
          providerName,
        };
      }

      await prisma.importJob.update({
        where: {
          id: importJob.id,
        },
        data: {
          jobStatus: JobStatus.SUCCEEDED,
          finishedAt: new Date(),
          errorText: null,
          resultSummaryJson: toJsonSummary(resultSummary),
        },
      });

      log('job_succeeded', {
        jobId: importJob.id,
        jobType: importJob.jobType,
        providerName,
        mode: resultSummary.mode,
        importedItemCount: resultSummary.importedItemCount,
      });

      return {
        jobId: importJob.id,
        skipped: false,
        resultSummary,
      };
    },
    {
      connection,
      concurrency: Number.isNaN(concurrency) ? 1 : Math.max(concurrency, 1),
    },
  );

  worker.on('failed', async (job, error) => {
    const jobId = job?.data.jobId;
    log('job_failed', {
      jobId,
      error: error.message,
    });

    if (!jobId) {
      return;
    }

    await prisma.importJob.updateMany({
      where: {
        id: jobId,
        jobStatus: JobStatus.RUNNING,
      },
      data: {
        jobStatus: JobStatus.FAILED,
        finishedAt: new Date(),
        errorText: error.message,
        resultSummaryJson: toJsonSummary({
          mode: 'worker_stub',
          phase: 'failed',
          summaryText: 'Worker failed while processing the import job.',
          warnings: [error.message],
        }),
      },
    });
  });

  worker.on('ready', () => {
    log('ready', {
      concurrency: Number.isNaN(concurrency) ? 1 : Math.max(concurrency, 1),
    });
  });

  return worker;
}

function toJsonSummary(summary: ImportJobResultSummaryDto) {
  return summary as unknown as Prisma.InputJsonValue;
}
