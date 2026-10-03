// The mailroom reads its configuration when config.js is first required, so
// point it at a throwaway database and inbox before any test requires it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'front-desk-legacy-'));

process.env.FRONT_DESK_DB = path.join(dir, 'front-desk.db');
process.env.MAILROOM_INBOX = path.join(dir, 'inbox');
process.env.MAILROOM_LOCK = path.join(dir, 'mailroom.lock');
// The automation rules have their own tests; keep them out of everything else.
process.env.MAILROOM_RULES = 'off';
process.env.MAILROOM_FIXTURES = path.resolve(import.meta.dirname, '../../fixtures/mail');

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});
