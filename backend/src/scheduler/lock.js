/**
 * File-based exclusive lock for preventing duplicate job execution.
 *
 * Uses fs.open(path, 'wx') (exclusive creation) to atomically claim a lock.
 * The lock file contains the PID and timestamp of the holder, allowing
 * detection of stale locks left behind by crashed processes.
 *
 * This works across multiple processes on the same host (file system level)
 * without requiring external dependencies like Redis.
 */

import os from 'node:os';
import { promises as fs } from 'node:fs';

const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes default
const LOCK_POLL_INTERVAL_MS = 1000; // 1 second

/**
 * Attempt to acquire an exclusive lock.
 *
 * @param {object} options
 * @param {string} options.lockDir - directory for lock files
 * @param {string} options.lockName - name of the lock (e.g. 'expire-orders')
 * @param {number} options.ttlMs - lock TTL in milliseconds
 * @param {number} options.pid - process ID (defaults to process.pid)
 * @returns {Promise<{ acquired: boolean, lockPath: string }>}
 */
export async function acquireLock({
  lockDir = os.tmpdir(),
  lockName,
  ttlMs = LOCK_TTL_MS,
  pid = process.pid,
} = {}) {
  const lockPath = `${lockDir}/${lockName}.lock`;
  const now = Date.now();
  const content = JSON.stringify({ pid, acquiredAt: now, ttlMs });

  try {
    // 'wx' flag: create file exclusively, fails if it already exists
    const fd = await fs.open(lockPath, 'wx');
    await fd.write(content);
    await fd.close();
    return { acquired: true, lockPath };
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }

    // Lock file exists — check if it's stale (older than ttlMs)
    try {
      const existing = await fs.readFile(lockPath, 'utf8');
      const { acquiredAt, ttlMs: existingTtl } = JSON.parse(existing);

      const isStale = Date.now() - acquiredAt > (existingTtl || ttlMs);

      if (isStale) {
        // Stale lock — remove it and retry
        await fs.unlink(lockPath);
        const retryFd = await fs.open(lockPath, 'wx');
        await retryFd.write(content);
        await retryFd.close();
        return { acquired: true, lockPath };
      }

      // Lock exists and is held by another process — acquisition denied
      return { acquired: false, lockPath, reason: 'lock_held' };
    } catch (readErr) {
      // If we can't read the lock file, treat it as stale and retry
      try {
        await fs.unlink(lockPath);
      } catch {
        // ignore
      }
      const retryFd = await fs.open(lockPath, 'wx');
      await retryFd.write(content);
      await retryFd.close();
      return { acquired: true, lockPath };
    }
  }
}

/**
 * Release an exclusive lock.
 *
 * @param {object} options
 * @param {string} options.lockPath - path to the lock file
 * @returns {Promise<void>}
 */
export async function releaseLock({ lockPath }) {
  try {
    await fs.unlink(lockPath);
  } catch {
    // Lock may already be gone — that's fine
  }
}

export async function isLocked({
  lockDir = os.tmpdir(),
  lockName,
  ttlMs = LOCK_TTL_MS,
} = {}) {
  const lockPath = `${lockDir}/${lockName}.lock`;
  try {
    const existing = await fs.readFile(lockPath, 'utf8');
    const { acquiredAt, ttlMs: existingTtl } = JSON.parse(existing);
    // Return true when the lock is ACTIVE (not yet expired), false when stale/expired
    return Date.now() - acquiredAt <= (existingTtl || ttlMs);
  } catch {
    return false;
  }
}
