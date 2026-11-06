/**
 * Dedicated worker process entry point for background jobs.
 *
 * Run this as a standalone process (separate from the Express API server)
 * when you want job scheduling isolated from web traffic:
 *
 *   node src/worker.js
 *
 * Requires JOBS_ENABLED=true and appropriate interval env vars.
 *
 * The worker starts the scheduler and handles graceful shutdown on SIGTERM/SIGINT.
 */

import { getScheduler } from './scheduler/index.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

if (!env.JOBS_ENABLED) {
  logger.warn({ jobsEnabled: false }, 'worker_started_without_jobs_enabled');
  process.exit(0);
}

const scheduler = getScheduler({
  lockDir: env.JOBS_LOCK_DIR,
  lockTtlMs: env.JOBS_LOCK_TTL_MINUTES * 60 * 1000,
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'worker_shutdown_started');
  scheduler
    .stop()
    .then(() => {
      logger.info({ signal }, 'worker_shutdown_complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err, signal }, 'worker_shutdown_failed');
      process.exit(1);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

scheduler
  .start()
  .then(() => {
    logger.info({ jobNames: ['expire-orders', 'reconcile-payments'] }, 'worker_started');
  })
  .catch((err) => {
    logger.error({ err }, 'worker_start_failed');
    process.exit(1);
  });
