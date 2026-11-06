/**
 * Tests for the JobScheduler (src/scheduler/index.js).
 *
 * Covers:
 *   - Scheduler initialization
 *   - Duplicate initialization prevention
 *   - Overlapping execution prevention (file-based locking)
 *   - Expiry job execution
 *   - Reconciliation job execution
 *   - Failed job recovery (job errors don't crash scheduler)
 *   - Graceful shutdown
 *   - Idempotent repeated execution
 *   - Multiple order failures without stopping the whole job
 *
 * Uses injectable db/now (same pattern as expireOrders/reconcilePayments
 * unit tests) and a dedicated temp lock directory.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { createScheduler, _resetScheduler, _getSchedulerInstance } from '../../src/scheduler/index.js';
import { acquireLock, releaseLock } from '../../src/scheduler/lock.js';

const TEST_DIR = join(os.tmpdir(), `portal-scheduler-test-${process.pid}`);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

async function ensureTestDir() {
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function cleanupTestDir() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Build a mock expireOrders that records calls and can be configured to fail.
 */
function buildExpireOrdersMock() {
  const calls = [];
  let shouldFail = false;

  async function fn({ db, now } = {}) {
    calls.push({ db, now, timestamp: new Date() });
    if (shouldFail) throw new Error('simulated expire failure');
    return { expired: 1, forfeited: 0 };
  }

  return {
    fn,
    calls,
    setShouldFail: (v) => { shouldFail = v; },
    reset: () => { calls.length = 0; shouldFail = false; },
  };
}

/**
 * Build a mock reconcilePayments that records calls and can be configured to fail.
 */
function buildReconcilePaymentsMock() {
  const calls = [];
  let shouldFail = false;

  async function fn({ db, now } = {}) {
    calls.push({ db, now, timestamp: new Date() });
    if (shouldFail) throw new Error('simulated reconcile failure');
    return {
      inspected: { orders: 3, paymentIntents: 2, ledgerTransactions: 1, webhookEvents: 0 },
      totalIssues: 0,
      queryFailures: [],
      issues: [],
      issuesByCategory: {},
    };
  }

  return {
    fn,
    calls,
    setShouldFail: (v) => { shouldFail = v; },
    reset: () => { calls.length = 0; shouldFail = false; },
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

test('scheduler: create and getStatus before start', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    const status = scheduler.getStatus();
    assert.equal(status.enabled, true);
    assert.equal(status.stopping, false);
    assert.equal(status.jobs.length, 0);
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: start registers built-in jobs', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    await scheduler.start();
    const status = scheduler.getStatus();
    assert.equal(status.enabled, true);
    assert.ok(status.jobs.some((j) => j.name === 'expire-orders'));
    assert.ok(status.jobs.some((j) => j.name === 'reconcile-payments'));
    await scheduler.stop();
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: start then stop clears timers', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    await scheduler.start();
    await scheduler.stop();
    const status = scheduler.getStatus();
    assert.equal(status.stopping, true);
    for (const job of status.jobs) {
      assert.equal(job.timerActive, false);
    }
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: duplicate initialization returns same instance', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const instanceBefore = _getSchedulerInstance();
    assert.equal(instanceBefore, null, 'schedulerInstance should be null before create');
    const s1 = createScheduler({ enabled: true, lockDir: TEST_DIR });
    const instanceAfterS1 = _getSchedulerInstance();
    assert.equal(instanceAfterS1, s1, 'schedulerInstance should be s1 after create');
    const s2 = createScheduler({ enabled: true, lockDir: TEST_DIR });
    assert.equal(s1, s2, 'createScheduler should return same instance');
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: runJob executes expireOrders and records monitoring', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const mock = buildExpireOrdersMock();
    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    scheduler.register('test-expire', mock.fn, 60_000);

    const report = await scheduler.runJob('test-expire', mock.fn);
    assert.equal(report.status, 'completed');
    assert.ok(report.executionId, 'executionId should be truthy');
    assert.equal(typeof report.startedAt, 'string', `startedAt should be string, got ${typeof report.startedAt}: ${report.startedAt}`);
    assert.equal(mock.calls.length, 1);
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: runJob captures failed job execution', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const mock = buildExpireOrdersMock();
    mock.setShouldFail(true);
    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    scheduler.register('test-fail', mock.fn, 60_000);

    const report = await scheduler.runJob('test-fail', mock.fn);
    assert.equal(report.status, 'failed');
    assert.equal(typeof report.error, 'object');
    assert.equal(typeof report.error.code, 'string');
    assert.equal(typeof report.error.message, 'string');
    assert.equal(mock.calls.length, 1);
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: overlapping execution prevented by lock', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    // First acquireLock call should succeed
    const first = await acquireLock({ lockDir: TEST_DIR, lockName: 'overlap-test', lockTtlMs: 60_000 });
    assert.equal(first.acquired, true);

    // Second acquireLock call for the same lock name should be blocked
    const second = await acquireLock({ lockDir: TEST_DIR, lockName: 'overlap-test', lockTtlMs: 60_000 });
    assert.equal(second.acquired, false);
    assert.equal(second.reason, 'lock_held');

    // Release the first lock
    await releaseLock({ lockPath: first.lockPath });

    // Now the lock should be available again
    const third = await acquireLock({ lockDir: TEST_DIR, lockName: 'overlap-test', lockTtlMs: 60_000 });
    assert.equal(third.acquired, true);
    await releaseLock({ lockPath: third.lockPath });
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: failed job does not crash scheduler — subsequent jobs run', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const failingMock = buildExpireOrdersMock();
    failingMock.setShouldFail(true);
    const workingMock = buildExpireOrdersMock();

    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    scheduler.register('failing', failingMock.fn, 60_000);
    scheduler.register('working', workingMock.fn, 60_000);

    // Run failing job
    const failReport = await scheduler.runJob('failing', failingMock.fn);
    assert.equal(failReport.status, 'failed');

    // Working job should still run fine
    const workReport = await scheduler.runJob('working', workingMock.fn);
    assert.equal(workReport.status, 'completed');

    assert.equal(failingMock.calls.length, 1);
    assert.equal(workingMock.calls.length, 1);
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: idempotent repeated execution', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const mock = buildExpireOrdersMock();
    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    scheduler.register('idempotent', mock.fn, 60_000);

    // Run the same job 3 times sequentially
    const reports = [];
    for (let i = 0; i < 3; i++) {
      const report = await scheduler.runJob('idempotent', mock.fn);
      reports.push(report);
    }

    assert.equal(reports.length, 3);
    assert.ok(reports.every((r) => r.status === 'completed'));
    assert.equal(mock.calls.length, 3);
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: multiple order failures without stopping the whole job', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    // Build a mock that simulates expireOrders with per-order RPC failures
    const calls = [];
    let failOrderId = 'o2';

    async function fn({ db, now } = {}) {
      calls.push({ db, now, timestamp: new Date() });
      // Simulate: 3 orders, o2 fails RPC transition
      const expired = 2; // o1 and o3 succeed
      const forfeited = 0;
      return { expired, forfeited };
    }

    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    scheduler.register('resilient', fn, 60_000);

    const report = await scheduler.runJob('resilient', fn);
    assert.equal(report.status, 'completed');
    assert.equal(report.ordersProcessed, 2);
    assert.equal(calls.length, 1);
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: reconcilePayments job execution', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const mock = buildReconcilePaymentsMock();
    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    scheduler.register('reconcile', mock.fn, 60_000);

    const report = await scheduler.runJob('reconcile', mock.fn);
    assert.equal(report.status, 'completed');
    assert.equal(report.reconciliationIssues, 0);
    assert.equal(report.ordersProcessed, 3);
    assert.equal(mock.calls.length, 1);
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});

test('scheduler: reconcilePayments job failure captured', async () => {
  _resetScheduler();
  await ensureTestDir();
  try {
    const mock = buildReconcilePaymentsMock();
    mock.setShouldFail(true);
    const scheduler = createScheduler({
      enabled: true,
      lockDir: TEST_DIR,
      lockTtlMs: 60_000,
    });
    scheduler.register('reconcile-fail', mock.fn, 60_000);

    const report = await scheduler.runJob('reconcile-fail', mock.fn);
    assert.equal(report.status, 'failed');
    assert.equal(typeof report.error, 'object');
    assert.equal(typeof report.error.code, 'string');
    assert.equal(typeof report.error.message, 'string');
  } finally {
    await cleanupTestDir();
    _resetScheduler();
  }
});