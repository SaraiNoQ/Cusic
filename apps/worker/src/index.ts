import { PrismaClient } from '@prisma/client';
import { createImportsWorker } from './imports-worker.js';

const heartbeatMs = Number.parseInt(
  process.env.WORKER_HEARTBEAT_MS ?? '60000',
  10,
);

function log(status: string, extra?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      service: 'worker',
      status,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
  );
}

async function main() {
  const prisma = new PrismaClient();
  const importsWorker = createImportsWorker(prisma);

  log('bootstrapped', { heartbeatMs });

  const timer = setInterval(() => {
    log('heartbeat');
  }, heartbeatMs);

  const shutdown = async (signal: string) => {
    clearInterval(timer);
    log('shutting_down', { signal });
    await importsWorker.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (error: unknown) => {
  console.error(
    JSON.stringify({
      service: 'worker',
      status: 'fatal',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
