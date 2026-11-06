/**
 * Execution monitoring for background jobs.
 *
 * Produces structured operational reports with:
 *   - Job name
 *   - Execution ID (UUID v4)
 *   - Start and completion timestamps
 *   - Success/failure status
 *   - Number of orders processed
 *   - Number of transitions made
 *   - Reconciliation issue count
 *   - Sanitized error information (no secrets)
 */

import * as crypto from 'node:crypto';

/**
 * Create a structured execution report.
 *
 * @param {object} options
 * @param {string} options.jobName - name of the job (e.g. 'expire-orders')
 * @param {string} options.executionId - unique execution ID (generated if omitted)
 * @param {string} options.status - 'started' | 'completed' | 'failed'
 * @param {Date} [options.startedAt] - start timestamp (defaults to now)
 * @param {Date} [options.completedAt] - completion timestamp
 * @param {object} [options.counts] - counts object (orders processed, transitions, issues)
 * @param {Error} [options.error] - sanitized error (message and code only)
 * @returns {object}
 */
export function createExecutionReport({
  jobName,
  executionId,
  status,
  startedAt = new Date(),
  completedAt,
  counts = {},
  error,
}) {
  const resolvedExecutionId = executionId ?? crypto.randomUUID();
  const report = {
    executionId: resolvedExecutionId,
    jobName,
    status,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt ? completedAt.toISOString() : undefined,
    durationMs:
      completedAt && startedAt
        ? completedAt.getTime() - startedAt.getTime()
        : undefined,
    ordersProcessed: counts.ordersProcessed ?? 0,
    transitionsMade: counts.transitionsMade ?? 0,
    reconciliationIssues: counts.reconciliationIssues ?? 0,
  };

  if (error) {
    report.error = {
      code: error.code ?? 'UNKNOWN_ERROR',
      message: error.message ?? String(error),
    };
  }

  return report;
}

/**
 * Sanitize an error for logging — strip stack traces and sensitive data.
 *
 * @param {Error} error
 * @returns {Error}
 */
export function sanitizeError(error) {
  return {
    code: error.code ?? 'UNKNOWN_ERROR',
    message: error.message ?? String(error),
  };
}

/**
 * Format an execution report as a structured log message.
 *
 * @param {object} report - output of createExecutionReport
 * @returns {object}
 */
export function formatLogEntry(report) {
  const base = {
    event: 'job_execution',
    jobName: report.jobName,
    executionId: report.executionId,
    status: report.status,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    durationMs: report.durationMs,
    ordersProcessed: report.ordersProcessed,
    transitionsMade: report.transitionsMade,
    reconciliationIssues: report.reconciliationIssues,
  };

  if (report.error) {
    base.error = report.error;
  }

  return base;
}
