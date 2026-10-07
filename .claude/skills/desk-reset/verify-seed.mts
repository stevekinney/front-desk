/**
 * Check that the database looks like a fresh seed of this checkout's inbox.
 *
 *   npx tsx .claude/skills/desk-reset/verify-seed.mts
 *
 * Expected values come from the source, not from hardcoded numbers, so the
 * check keeps working as the seed changes:
 *
 *   - every mail file in inbox/ (except drop-*) has a mailroom_seen row
 *   - every ticket came from a mail file (tickets from drop-* files are
 *     counted separately, as a sign the desk has been used since the seed)
 *   - teammates, tags and canned replies match seed-data.ts
 *   - every ticket has an SLA from the mailroom
 *
 * Prints counts by status. Exits 0 when every check passes, 1 otherwise.
 * Opens the database the way the API does; it doesn't write any rows.
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { loadConfig } from '../../../apps/api/src/config.ts';
import { openDatabase } from '../../../apps/api/src/database.ts';
import { closeLegacy, getSla } from '../../../apps/api/src/legacy-adapter.ts';
import { cannedReplies, tags, teammates } from '../../../apps/api/src/seed/seed-data.ts';
import { log } from '../../lib/log.mts';

const config = loadConfig();
if (!existsSync(config.databasePath)) {
  log.error(`FAIL no database at ${config.databasePath}`);
  process.exit(1);
}

const inbox = path.resolve(process.env.MAILROOM_INBOX ?? 'inbox');
const mailFiles = readdirSync(inbox).filter(
  (name) => !name.startsWith('drop-') && /\.(json|eml)$/i.test(name),
);

const db = openDatabase(config.databasePath);
const failures: string[] = [];

function count(sql: string): number {
  return (db.prepare(sql).get() as { n: number }).n;
}

function expect(label: string, actual: number, expected: number): void {
  const ok = actual === expected;
  if (!ok) failures.push(label);
  const line = `${ok ? 'ok  ' : 'FAIL'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`;
  if (ok) log.info(line);
  else log.error(line);
}

const seen = new Set(
  (db.prepare('SELECT filename FROM mailroom_seen').all() as { filename: string }[]).map(
    (row) => row.filename,
  ),
);
const unseen = mailFiles.filter((name) => !seen.has(name));
expect('inbox files ingested', mailFiles.length - unseen.length, mailFiles.length);
for (const name of unseen) log.error(`       not ingested: ${name}`);

const tickets = count('SELECT count(*) AS n FROM tickets');
const fromMail = count('SELECT count(DISTINCT ticket_id) AS n FROM mailroom_seen');
expect('tickets opened by mail', fromMail, tickets);
const fromDrops = count(
  `SELECT count(DISTINCT ticket_id) AS n FROM mailroom_seen
    WHERE filename LIKE 'drop-%'
      AND ticket_id NOT IN (SELECT ticket_id FROM mailroom_seen WHERE filename NOT LIKE 'drop-%')`,
);
if (fromDrops > 0) {
  log.warn(`note ${fromDrops} ticket(s) came from dropped mail, so this isn't a fresh seed`);
}

expect('teammates', count('SELECT count(*) AS n FROM teammates'), teammates.length);
expect('tags', count('SELECT count(*) AS n FROM tags'), tags.length);
expect('canned replies', count('SELECT count(*) AS n FROM canned_replies'), cannedReplies.length);

const ids = (db.prepare('SELECT id FROM tickets').all() as { id: number }[]).map((row) => row.id);
let withSla = 0;
for (const id of ids) if (await getSla(id)) withSla += 1;
expect('tickets with an SLA', withSla, ids.length);

const byStatus = db
  .prepare('SELECT status, count(*) AS n FROM tickets GROUP BY status ORDER BY status')
  .all() as { status: string; n: number }[];
log.info(
  `\n${tickets} tickets from ${mailFiles.length} inbox files: ` +
    byStatus.map((row) => `${row.n} ${row.status}`).join(', '),
);

closeLegacy();
db.close();

if (failures.length > 0) {
  log.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
