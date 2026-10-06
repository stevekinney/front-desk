/**
 * Stop the dev server that dev-up.mts started, and only that one. A server
 * that was already running when the skill began is left alone.
 */
import { setTimeout as sleep } from 'node:timers/promises';

import { isAlive } from '../../lib/mailroom-lock.mts';
import { log } from '../../lib/log.mts';
import { apiPort, forgetStarted, listener, readStarted, root, webPort } from './dev-server.mts';

const started = readStarted();
if (!started || started.root !== root) {
  log.info(
    'NOTHING TO STOP: this skill did not start a dev server here. Left any running server alone.',
  );
  process.exit(0);
}

if (isAlive(started.pid)) {
  // The negative pid signals the whole process group: npm, dev.ts, tsx and vite.
  process.kill(-started.pid, 'SIGTERM');
  for (let i = 0; i < 20 && (listener(apiPort) !== null || listener(webPort) !== null); i++) {
    await sleep(250);
  }
  if (isAlive(started.pid)) process.kill(-started.pid, 'SIGKILL');
}

forgetStarted();
const stillListening = [apiPort, webPort].filter((port) => listener(port) !== null);
if (stillListening.length > 0) {
  log.warn(`STOPPED, but something still listens on ${stillListening.join(' and ')}.`);
  process.exit(1);
}
log.info(`STOPPED the dev server started at ${started.startedAt}.`);
