/**
 * `npm run e2e`: the browser tests. Playwright starts its own API and web
 * server against a throwaway database, inbox and mailroom lock, on ports 10000
 * above this checkout's dev ports, so it never touches data/ or a running
 * `npm run dev`. The database is seeded from a copy of inbox/, the same way
 * `npm run reset` seeds data/.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');

function prepareDesk(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'front-desk-e2e-'));
  const inbox = path.join(dir, 'inbox');
  mkdirSync(inbox);
  for (const name of readdirSync(path.join(root, 'inbox'))) {
    if (!name.startsWith('drop-')) cpSync(path.join(root, 'inbox', name), path.join(inbox, name));
  }
  return dir;
}

// Workers load this file too. They inherit the runner's environment, so only
// the runner makes a directory.
process.env.FRONT_DESK_E2E_DIR ??= prepareDesk();
const dir = process.env.FRONT_DESK_E2E_DIR;

const apiPort = Number(process.env.E2E_PORT ?? Number(process.env.PORT ?? 4100) + 10_000);
const webPort = Number(process.env.E2E_WEB_PORT ?? Number(process.env.WEB_PORT ?? 5173) + 10_000);

const env = {
  PORT: String(apiPort),
  WEB_PORT: String(webPort),
  FRONT_DESK_DB: path.join(dir, 'front-desk.db'),
  MAILROOM_INBOX: path.join(dir, 'inbox'),
  MAILROOM_LOCK: path.join(dir, 'mailroom.lock'),
  MAILROOM_POLL_MS: '250',
};

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: '.results',
  globalTeardown: './support/teardown.ts',
  // Every test shares one desk, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node_modules/.bin/tsx apps/api/src/server.ts',
      cwd: root,
      env,
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: false,
    },
    {
      command: 'node_modules/.bin/vite --config apps/web/vite.config.ts --strictPort',
      cwd: root,
      env,
      url: `http://localhost:${webPort}`,
      reuseExistingServer: false,
    },
  ],
});
