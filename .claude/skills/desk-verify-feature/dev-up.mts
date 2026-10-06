/**
 * Make sure this checkout's `npm run dev` is up, and print where.
 *
 *   exit 0  RUNNING (it was already up) or STARTED (this script started it)
 *   exit 1  FAILED: it was started but didn't come up; the log tail follows
 *   exit 2  BLOCKED: a port or the mailroom lock belongs to someone else
 *
 * A server this script starts runs detached and is recorded, so dev-down.mts
 * stops it and nothing else.
 */
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, openSync, readFileSync, statSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import { log } from '../../lib/log.mts';
import { liveLockOwner, mailroomLockPath } from '../../lib/mailroom-lock.mts';
import {
  apiPort,
  cwdOf,
  listener,
  logFile,
  readStarted,
  responds,
  root,
  webPort,
  writeStarted,
} from './dev-server.mts';

const apiUrl = `http://localhost:${apiPort}`;
const healthUrl = `${apiUrl}/api/health`;

function blocked(problem: string): never {
  log.error(`BLOCKED: ${problem}`);
  log.error(
    'This checkout needs its own PORT, WEB_PORT and MAILROOM_LOCK. See the desk-setup skill.',
  );
  process.exit(2);
}

function describeOwner(pid: number): string {
  const cwd = cwdOf(pid);
  return cwd === root
    ? `pid ${pid} in this checkout`
    : `pid ${pid} in ${cwd ?? 'an unknown directory'}`;
}

// 1. Already up?
const apiPid = listener(apiPort);
if (apiPid !== null) {
  if (cwdOf(apiPid) !== root) blocked(`port ${apiPort} is held by ${describeOwner(apiPid)}.`);
  const webPid = listener(webPort);
  if (webPid === null || cwdOf(webPid) !== root) {
    blocked(
      `the API is up on ${apiPort} but the web app isn't on ${webPort} in this checkout` +
        (webPid === null ? '.' : ` (${describeOwner(webPid)}).`),
    );
  }
  // tsx watch restarts the API after every edit; give it a moment.
  for (let i = 0; i < 20 && !(await responds(healthUrl)); i++) await sleep(500);
  const started = readStarted();
  log.info(
    started ? 'RUNNING (started earlier by this skill)' : 'RUNNING (already up; leave it running)',
  );
  log.info(`api: ${apiUrl}`);
  log.info(`web: http://localhost:${webPort}`);
  if (started) log.info(`log: ${started.log}`);
  process.exit(0);
}

// 2. Free to start?
const webPid = listener(webPort);
if (webPid !== null) blocked(`port ${webPort} is held by ${describeOwner(webPid)}.`);
const lockOwner = liveLockOwner();
if (lockOwner !== null) {
  blocked(`the mailroom lock ${mailroomLockPath()} is held by ${describeOwner(lockOwner)}.`);
}

// 3. Start it, detached, in its own process group so dev-down can stop all of it.
// Append, so the log of a server that died is still there after a restart.
const logStart = existsSync(logFile) ? statSync(logFile).size : 0;
appendFileSync(logFile, `\n── dev-up ${new Date().toISOString()} ──\n`);
const out = openSync(logFile, 'a');
const child = spawn('npm', ['run', 'dev'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', out, out],
});
child.unref();
let exited = false;
child.on('exit', () => (exited = true));

const deadline = Date.now() + 60_000;
let webUrl: string | null = null;
while (Date.now() < deadline && !exited) {
  // Vite moves to the next port if WEB_PORT is taken; trust what it prints.
  const output = readFileSync(logFile, 'utf8')
    .slice(logStart)
    .replace(/\x1b\[[0-9;]*m/g, '');
  const match = /Local:\s+(http:\/\/localhost:\d+)/.exec(output);
  webUrl = match?.[1] ?? null;
  if (webUrl && (await responds(healthUrl)) && (await responds(webUrl))) break;
  webUrl = null;
  await sleep(500);
}

if (!webUrl) {
  if (!exited && child.pid) process.kill(-child.pid, 'SIGTERM');
  log.error(`FAILED: npm run dev didn't come up within 60s${exited ? ' (it exited)' : ''}.`);
  log.error(`log: ${logFile}`);
  log.error(readFileSync(logFile, 'utf8').split('\n').slice(-30).join('\n'));
  process.exit(1);
}

writeStarted({
  pid: child.pid!,
  root,
  log: logFile,
  apiUrl,
  webUrl,
  startedAt: new Date().toISOString(),
});
log.info('STARTED (stop it with dev-down.mts when you are done)');
log.info(`api: ${apiUrl}`);
log.info(`web: ${webUrl}`);
log.info(`log: ${logFile}`);
