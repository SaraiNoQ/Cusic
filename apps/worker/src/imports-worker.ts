import { JobStatus, JobType, Prisma, PrismaClient } from '@prisma/client';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';

type ImportQueueJobData = {
  jobId: string;
};

type ImportJobResultSummaryDto = {
  mode: 'baseline_stub' | 'worker_stub';
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

      const resultSummary = buildSucceededSummary(importJob.jobType);

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

function buildSucceededSummary(jobType: JobType): ImportJobResultSummaryDto {
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

function toJsonSummary(summary: ImportJobResultSummaryDto) {
  return summary as unknown as Prisma.InputJsonValue;
}
