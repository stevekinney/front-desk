/**
 * Put the desk back to its starting state: a fresh database seeded from
 * inbox/, and no dropped mail. Stop `npm run dev` before running this.
 */
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import { loadConfig } from '../apps/api/src/config.ts';
import { openDatabase } from '../apps/api/src/database.ts';
import { closeLegacy } from '../apps/api/src/legacy-adapter.ts';
import { seedDatabase } from '../apps/api/src/seed/seed.ts';

const config = loadConfig();

for (const suffix of ['', '-wal', '-shm']) {
  rmSync(config.databasePath + suffix, { force: true });
}

const inbox = path.resolve(process.env.MAILROOM_INBOX ?? 'inbox');
const dropped = readdirSync(inbox).filter((name) => name.startsWith('drop-'));
for (const name of dropped) rmSync(path.join(inbox, name));

const db = openDatabase(config.databasePath);
const count = await seedDatabase(db);
closeLegacy();
db.close();

console.log(`Removed ${dropped.length} dropped message(s) from inbox/`);
console.log(`Seeded ${count} tickets into ${path.relative(process.cwd(), config.databasePath)}`);
