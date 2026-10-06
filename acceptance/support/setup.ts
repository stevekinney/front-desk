// Every acceptance file gets its own throwaway database, inbox and lock, set
// before anything loads the mailroom (it reads its configuration on require).
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll } from 'vitest';

const dir = mkdtempSync(path.join(tmpdir(), 'front-desk-acceptance-'));
mkdirSync(path.join(dir, 'inbox'));

process.env.FRONT_DESK_DB = path.join(dir, 'front-desk.db');
process.env.MAILROOM_INBOX = path.join(dir, 'inbox');
process.env.MAILROOM_LOCK = path.join(dir, 'mailroom.lock');
process.env.FINANCE_EXPORT_DIR = path.join(dir, 'exports');
process.env.MAILROOM_FIXTURES = path.resolve(import.meta.dirname, '../../fixtures/mail');
process.env.MAILROOM_RULES = 'off';
process.env.ACCEPTANCE_DIR = dir;

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
