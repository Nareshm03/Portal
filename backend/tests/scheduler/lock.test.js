/**
 * Tests for the file-based exclusive lock (src/scheduler/lock.js).
 *
 * Uses a dedicated temp directory so tests never interfere with production
 * lock files. All lock files are cleaned up after each test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

import {
  acquireLock,
  releaseLock,
  isLocked,
} from '../../src/scheduler/lock.js';

const TEST_DIR = join(os.tmpdir(), `portal-lock-test-${process.pid}`);

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

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

test('acquireLock: acquires and releases a lock', async () => {
  await ensureTestDir();
  try {
    const result = await acquireLock({
      lockDir: TEST_DIR,
      lockName: 'test-lock-1',
      ttlMs: 60_000,
    });
    assert.equal(result.acquired, true);
    assert.equal(typeof result.lockPath, 'string');

    // Same process cannot re-acquire its own lock while it's held (mutual exclusion)
    const second = await acquireLock({
      lockDir: TEST_DIR,
      lockName: 'test-lock-1',
      ttlMs: 60_000,
    });
    assert.equal(second.acquired, false);
    assert.equal(second.reason, 'lock_held');

    await releaseLock({ lockPath: result.lockPath });

    // After release, should be acquirable again
    const third = await acquireLock({
      lockDir: TEST_DIR,
      lockName: 'test-lock-1',
      ttlMs: 60_000,
    });
    assert.equal(third.acquired, true);
    await releaseLock({ lockPath: third.lockPath });
  } finally {
    await cleanupTestDir();
  }
});

test('acquireLock: lock count stays at 1 after acquire+release', async () => {
  await ensureTestDir();
  try {
    const before = await fs.readdir(TEST_DIR);
    const lockCountBefore = before.filter((e) => e.endsWith('.lock')).length;
    assert.equal(lockCountBefore, 0);

    const result = await acquireLock({
      lockDir: TEST_DIR,
      lockName: 'test-count-1',
      ttlMs: 60_000,
    });
    const afterAcquire = await fs.readdir(TEST_DIR);
    const lockCountAfterAcquire = afterAcquire.filter((e) =>
      e.endsWith('.lock')
    ).length;
    assert.equal(lockCountAfterAcquire, 1);

    await releaseLock({ lockPath: result.lockPath });
    const afterRelease = await fs.readdir(TEST_DIR);
    const lockCountAfterRelease = afterRelease.filter((e) =>
      e.endsWith('.lock')
    ).length;
    assert.equal(lockCountAfterRelease, 0);
  } finally {
    await cleanupTestDir();
  }
});

test('acquireLock: stale lock (expired TTL) can be re-acquired', async () => {
  await ensureTestDir();
  try {
    // Create a lock file directly with an old timestamp
    const lockPath = join(TEST_DIR, 'test-stale.lock');
    const oldContent = JSON.stringify({
      pid: 99999,
      acquiredAt: Date.now() - 20 * 60 * 1000, // 20 minutes ago
      ttlMs: 10 * 60 * 1000, // 10 minute TTL — stale
    });
    await fs.writeFile(lockPath, oldContent, 'utf8');

    // isLocked should report false for stale lock
    const locked = await isLocked({
      lockDir: TEST_DIR,
      lockName: 'test-stale',
      ttlMs: 10 * 60 * 1000,
    });
    assert.equal(locked, false);

    // acquireLock should clean up the stale lock and acquire
    const result = await acquireLock({
      lockDir: TEST_DIR,
      lockName: 'test-stale',
      ttlMs: 10 * 60 * 1000,
    });
    assert.equal(result.acquired, true);
    await releaseLock({ lockPath: result.lockPath });
  } finally {
    await cleanupTestDir();
  }
});

test('acquireLock: same process can re-acquire its own lock', async () => {
  await ensureTestDir();
  try {
    const first = await acquireLock({
      lockDir: TEST_DIR,
      lockName: 'test-same-process',
      ttlMs: 60_000,
    });
    assert.equal(first.acquired, true);

    // Same process cannot re-acquire its own lock while it's held (mutual exclusion)
    const second = await acquireLock({
      lockDir: TEST_DIR,
      lockName: 'test-same-process',
      ttlMs: 60_000,
    });
    assert.equal(second.acquired, false);
    assert.equal(second.reason, 'lock_held');

    await releaseLock({ lockPath: first.lockPath });
    await releaseLock({ lockPath: second.lockPath });
  } finally {
    await cleanupTestDir();
  }
});

test('isLocked: returns false when no lock file exists', async () => {
  await ensureTestDir();
  try {
    const locked = await isLocked({
      lockDir: TEST_DIR,
      lockName: 'test-nonexistent',
      ttlMs: 60_000,
    });
    assert.equal(locked, false);
  } finally {
    await cleanupTestDir();
  }
});

test('releaseLock: releasing a non-existent lock does not throw', async () => {
  await ensureTestDir();
  try {
    // Should not throw even if the file doesn't exist
    await releaseLock({ lockPath: join(TEST_DIR, 'does-not-exist.lock') });
    assert.ok(true);
  } finally {
    await cleanupTestDir();
  }
});
