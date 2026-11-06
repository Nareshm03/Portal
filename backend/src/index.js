import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { getScheduler } from './scheduler/index.js';

const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'portal_api_started'));

function shutdown(signal) {
  logger.info({ signal }, 'shutdown_started');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'shutdown_failed');
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the background job scheduler if enabled. This is intentionally
// non-blocking — if the scheduler fails to start, the API server keeps running.
if (env.JOBS_ENABLED) {
  const scheduler = getScheduler({
    lockDir: env.JOBS_LOCK_DIR,
    lockTtlMs: env.JOBS_LOCK_TTL_MINUTES * 60 * 1000,
  });
  scheduler.start().catch((err) => {
    logger.error({ err }, 'scheduler_start_failed');
  });
} else {
  logger.info({ jobsEnabled: false }, 'scheduler_disabled');
}
