/**
 * Who holds the mailroom lock, if anyone.
 *
 * Mirrors the check in legacy/ingest/poller.js, which the skills can't import:
 * only apps/api/src/legacy-adapter.ts reaches into legacy/, and the poller
 * doesn't export it.
 */
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** The lock file this checkout's mailroom uses. */
export function mailroomLockPath(): string {
  return process.env.MAILROOM_LOCK ?? path.join(os.tmpdir(), 'front-desk-mailroom.lock');
}

/** True when a process with this pid exists, even if it belongs to another user. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** The pid of the live process holding the lock, or null when nobody does. */
export function liveLockOwner(lockFile: string = mailroomLockPath()): number | null {
  if (!existsSync(lockFile)) return null;
  const owner = parseInt(readFileSync(lockFile, 'utf8'), 10);
  return owner && isAlive(owner) ? owner : null;
}
