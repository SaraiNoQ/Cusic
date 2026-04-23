const queueName = process.env.WORKER_QUEUE_NAME ?? 'music-ai-default';
const heartbeatMs = Number.parseInt(process.env.WORKER_HEARTBEAT_MS ?? '60000', 10);

function log(status: string, extra?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      service: 'worker',
      queueName,
      status,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
  );
}

async function main() {
  log('bootstrapped', { heartbeatMs });

  const timer = setInterval(() => {
    log('heartbeat');
  }, heartbeatMs);

  const shutdown = (signal: string) => {
    clearInterval(timer);
    log('shutting_down', { signal });
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
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
