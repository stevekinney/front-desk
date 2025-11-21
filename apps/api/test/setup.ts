// The mailroom reads its configuration when it is first required, so every
// test file gets its own throwaway database and inbox before anything loads.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll } from 'vitest';

const dir = mkdtempSync(path.join(tmpdir(), 'front-desk-api-'));
mkdirSync(path.join(dir, 'inbox'));

process.env.FRONT_DESK_DB = path.join(dir, 'front-desk.db');
process.env.MAILROOM_INBOX = path.join(dir, 'inbox');
process.env.MAILROOM_LOCK = path.join(dir, 'mailroom.lock');
process.env.MAILROOM_FIXTURES = path.resolve(import.meta.dirname, '../../../fixtures/mail');

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
