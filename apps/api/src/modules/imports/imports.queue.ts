import { IMPORTS_QUEUE_NAME, type ImportQueueJobData } from '@music-ai/shared';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

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

export function createImportsQueue() {
  const connection = createRedisConnection();

  return new Queue<ImportQueueJobData>(
    process.env.IMPORTS_QUEUE_NAME?.trim() || IMPORTS_QUEUE_NAME,
    {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    },
  );
}
