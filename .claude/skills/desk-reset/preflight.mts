/**
 * Is it safe to delete and reseed this checkout's database?
 *
 *   npx tsx .claude/skills/desk-reset/preflight.mts
 *
 * Checks, in this checkout's environment (FRONT_DESK_DB, MAILROOM_LOCK,
 * MAILROOM_INBOX, PORT):
 *
 *   - no other process has the database file open (lsof)
 *   - no live process holds the mailroom lock
 *   - nothing is listening on the API port
 *
 * Then lists the inbox/drop-* files that `npm run reset` would delete.
 *
 * Exits 0 when the desk is idle, 2 when something is using it, 1 on error.
 * Reads only; changes nothing.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { connect } from 'node:net';
import path from 'node:path';

import { log } from '../../lib/log.mts';
import { liveLockOwner, mailroomLockPath } from '../../lib/mailroom-lock.mts';

const databasePath = path.resolve(process.env.FRONT_DESK_DB ?? 'data/front-desk.db');
const lockFile = mailroomLockPath();
const inbox = path.resolve(process.env.MAILROOM_INBOX ?? 'inbox');
const port = Number(process.env.PORT ?? 4100);

const problems: string[] = [];

/** Processes other than this one with any of these files open. */
function openers(files: string[]): string[] {
  const present = files.filter((file) => existsSync(file));
  if (present.length === 0) return [];
  const result = spawnSync('lsof', ['-F', 'pc', '--', ...present], { encoding: 'utf8' });
  if (result.error) {
    log.warn(`  (lsof unavailable: ${result.error.message}; skipped the open-file check)`);
    return [];
  }
  const found = new Map<string, string>();
  let pid = '';
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('p')) pid = line.slice(1);
    else if (line.startsWith('c') && pid && pid !== String(process.pid))
      found.set(pid, line.slice(1));
  }
  return [...found].map(([p, command]) => `${command} (pid ${p})`);
}

/** The working directory of a process, when lsof can tell us. */
function cwdOf(pid: number): string | null {
  const result = spawnSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-F', 'n'], {
    encoding: 'utf8',
  });
  const line = result.stdout?.split('\n').find((l) => l.startsWith('n'));
  return line ? line.slice(1) : null;
}

function portInUse(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

log.info(`database  ${path.relative(process.cwd(), databasePath) || databasePath}`);
log.info(`lock      ${lockFile}`);
log.info(`api port  ${port}`);

const holders = openers([databasePath, `${databasePath}-wal`, `${databasePath}-shm`]);
if (holders.length > 0) problems.push(`the database is open in: ${holders.join(', ')}`);

const owner = liveLockOwner(lockFile);
if (owner) {
  const cwd = cwdOf(owner);
  const where = cwd ? ` running in ${cwd}` : '';
  const mine = cwd && path.resolve(cwd) === process.cwd() ? ' (this checkout)' : '';
  problems.push(`a mailroom poller holds the lock: pid ${owner}${where}${mine}`);
}

if (await portInUse()) problems.push(`something is listening on port ${port}`);

const dropped = existsSync(inbox)
  ? readdirSync(inbox).filter((name) => name.startsWith('drop-'))
  : [];
log.info(`\ndropped mail in ${path.relative(process.cwd(), inbox) || inbox}/: ${dropped.length}`);
for (const name of dropped) log.info(`  ${name}`);

if (problems.length > 0) {
  log.warn('\nBUSY: stop whatever is using the desk before resetting it.');
  for (const problem of problems) log.warn(`  - ${problem}`);
  process.exit(2);
}
log.info('\nIDLE: safe to reset.');
