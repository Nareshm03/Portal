/**
 * JobScheduler — manages scheduled execution of background jobs.
 *
 * Features:
 *   - Register named jobs with intervals
 *   - File-based locking to prevent overlapping executions
 *   - Graceful shutdown (in-flight jobs complete, no new starts)
 *   - Duplicate initialization prevention (module-level singleton guard)
 *   - Structured execution monitoring (job name, execution ID, timestamps, counts, sanitized errors)
 *   - Job exceptions are caught and logged — never crash the scheduler or the API server
 *
 * Usage:
 *   const scheduler = createScheduler({ enabled: true });
 *   scheduler.register('expire-orders', expireOrders, 5 * 60 * 1000);
 *   await scheduler.start();
 *   // ... later ...
 *   await scheduler.stop();
 */

import { acquireLock, releaseLock, isLocked } from './lock.js';
import {
  createExecutionReport,
  sanitizeError,
  formatLogEntry,
} from './monitor.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

// Module-level singleton guard — prevents accidental duplicate scheduler
// initialization when the module is imported in multiple places.
let schedulerInstance = null;

/**
 * Create a JobScheduler instance.
 *
 * @param {object} options
 * @param {boolean} [options.enabled=false] - whether automatic scheduling is active
 * @param {string} [options.lockDir] - directory for lock files
 * @param {number} [options.lockTtlMs] - lock TTL in milliseconds
 */
export function createScheduler({
  enabled = false,
  lockDir,
  lockTtlMs,
} = {}) {
  if (schedulerInstance) {
    return schedulerInstance;
  }

  schedulerInstance = {
    register,
    start,
    stop,
    getStatus,
    runJob,
  };
  const jobs = new Map(); // name -> { fn, intervalMs, timer, lastRun }
  let stopping = false;

  /**
   * Register a job to run on an interval.
   *
   * @param {string} name - unique job name
   * @param {Function} fn - async job function (injectable db/now supported)
   * @param {number} intervalMs - interval in milliseconds
   */
  function register(name, fn, intervalMs) {
    if (jobs.has(name)) {
      throw new Error(`Job already registered: ${name}`);
    }
    jobs.set(name, { fn, intervalMs, timer: null, lastRun: null });
  }

  /**
   * Run a single job execution with locking and monitoring.
   *
   * @param {string} name - unique job name
   * @param {Function} [fn] - optional function to run directly (for testing).
   *   If omitted, the registered job function is used.
   * @returns {Promise<object>} execution report
   */
  async function runJob(name, fn) {
    const jobFn = fn ?? jobs.get(name)?.fn;
    if (!jobFn) {
      throw new Error(`No job function registered for: ${name}`);
    }

    const lockName = `portal-job-${name}`;
    const lockResult = await acquireLock({
      lockDir,
      lockName,
      ttlMs: lockTtlMs,
    });

    if (!lockResult.acquired) {
      logger.debug(
        { jobName: name, lockName },
        'job_skipped_lock_held'
      );
      return {
        executionId: 'skipped',
        jobName: name,
        status: 'skipped',
        startedAt: new Date().toISOString(),
        reason: 'lock_held',
      };
    }

    const startedAt = new Date();
    const executionReport = createExecutionReport({
      jobName: name,
      status: 'started',
      startedAt,
    });

    logger.info(formatLogEntry(executionReport), 'job_started');

    let ordersProcessed = 0;
    let transitionsMade = 0;
    let reconciliationIssues = 0;
    let error = null;

    try {
      // expireOrders returns { expired, forfeited }
      // reconcilePayments returns buildSummary with inspected + issues
      const result = await jobFn();

      if (result && typeof result.expired === 'number') {
        ordersProcessed = result.expired + (result.forfeited ?? 0);
        transitionsMade = result.expired + (result.forfeited ?? 0);
      } else if (result && typeof result.inspected === 'object') {
        ordersProcessed = result.inspected.orders ?? 0;
        reconciliationIssues = result.totalIssues ?? 0;
        transitionsMade = 0;
      }

      const completedAt = new Date();
      executionReport.status = 'completed';
      executionReport.completedAt = completedAt;
      executionReport.durationMs =
        completedAt.getTime() - startedAt.getTime();
      executionReport.ordersProcessed = ordersProcessed;
      executionReport.transitionsMade = transitionsMade;
      executionReport.reconciliationIssues = reconciliationIssues;

      logger.info(
        formatLogEntry(executionReport),
        'job_completed'
      );
      return executionReport;
    } catch (err) {
      const completedAt = new Date();
      const sanitized = sanitizeError(err);

      executionReport.status = 'failed';
      executionReport.completedAt = completedAt;
      executionReport.durationMs =
        completedAt.getTime() - startedAt.getTime();
      executionReport.error = sanitized;

      logger.error(
        formatLogEntry(executionReport),
        'job_failed'
      );
      return executionReport;
    } finally {
      await releaseLock({ lockPath: lockResult.lockPath });
      const jobEntry = jobs.get(name);
      if (jobEntry) {
        jobEntry.lastRun = new Date();
      }
    }
  }

  /**
   * Start the scheduler. Registers the built-in jobs and begins intervals.
   */
  async function start() {
    if (stopping) {
      throw new Error('Scheduler is stopping');
    }

    // Register built-in jobs
    const { expireOrders } = await import('../jobs/expireOrders.js');
    const { reconcilePayments } = await import('../jobs/reconcilePayments.js');

    register(
      'expire-orders',
      expireOrders,
      env.EXPIRE_ORDERS_INTERVAL_MINUTES * 60 * 1000
    );
    register(
      'reconcile-payments',
      reconcilePayments,
      env.RECONCILE_PAYMENTS_INTERVAL_MINUTES * 60 * 1000
    );

    // Run each job immediately on start, then at its interval
    for (const [name, job] of jobs.entries()) {
      // Fire-and-forget initial run — errors are caught inside runJob
      runJob(name, job.fn).catch((err) => {
        logger.error({ err, jobName: name }, 'job_initial_run_failed');
      });

      job.timer = setInterval(async () => {
        if (stopping) return;
        await runJob(name, job.fn).catch((err) => {
          logger.error({ err, jobName: name }, 'job_interval_run_failed');
        });
      }, job.intervalMs);
    }

    logger.info(
      { jobNames: Array.from(jobs.keys()), enabled },
      'scheduler_started'
    );
  }

  /**
   * Stop the scheduler. Clears all intervals and rejects new runs.
   * In-flight jobs are allowed to complete.
   */
  async function stop() {
    stopping = true;

    for (const [name, job] of jobs.entries()) {
      if (job.timer) {
        clearInterval(job.timer);
        job.timer = null;
      }
    }

    logger.info({ jobNames: Array.from(jobs.keys()) }, 'scheduler_stopped');
  }

  /**
   * Get scheduler status for operational reporting.
   */
  function getStatus() {
    return {
      enabled,
      stopping,
      jobs: Array.from(jobs.entries()).map(([name, job]) => ({
        name,
        intervalMs: job.intervalMs,
        lastRun: job.lastRun ? job.lastRun.toISOString() : null,
        timerActive: !!job.timer,
      })),
    };
  }

  return schedulerInstance;
}

/**
 * Get the shared scheduler instance (creates it if needed).
 *
 * @param {object} options
 * @returns {object} scheduler instance
 */
export function getScheduler(options = {}) {
  if (!schedulerInstance) {
    schedulerInstance = createScheduler(options);
  }
  return schedulerInstance;
}

/**
 * Reset the singleton (primarily for testing).
 * @internal
 */
export function _resetScheduler() {
  schedulerInstance = null;
}

export function _getSchedulerInstance() {
  return schedulerInstance;
}
