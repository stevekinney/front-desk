/**
 * Ingest whatever is new in the inbox once, without starting the dev server,
 * and describe each ticket it touched.
 *
 *   npx tsx .claude/skills/desk-scenario/ingest-once.mts
 *
 * Goes through apps/api/src/legacy-adapter.ts, the only way into legacy/.
 * The automation rules run, as they do for real mail.
 *
 * Refuses to run while a live poller holds the mailroom lock: two pollers on
 * one inbox ingest the same file twice (docs/history/issues/97.md). Exits 0
 * on success, 2 when a poller is running, 1 on error.
 */
import { existsSync } from 'node:fs';

import { loadConfig } from '../../../apps/api/src/config.ts';
import { openDatabase } from '../../../apps/api/src/database.ts';
import { closeLegacy, getSla, pollInbox } from '../../../apps/api/src/legacy-adapter.ts';
import { tagsForTicket } from '../../../apps/api/src/tags/tags-repository.ts';
import { log } from '../../lib/log.mts';
import { liveLockOwner, mailroomLockPath } from '../../lib/mailroom-lock.mts';

const lockFile = mailroomLockPath();
const owner = liveLockOwner(lockFile);
if (owner) {
  log.warn(`A mailroom poller (pid ${owner}) holds ${lockFile}.`);
  log.warn('It will ingest new mail within a few seconds; read the result from the API.');
  process.exit(2);
}

const config = loadConfig();
if (!existsSync(config.databasePath)) {
  log.error(`No database at ${config.databasePath}. Seed one first (npm run reset).`);
  process.exit(1);
}

const db = openDatabase(config.databasePath);
const deliveries = await pollInbox();

if (deliveries.length === 0) log.info('Nothing new in the inbox.');
for (const delivery of deliveries) {
  const ticket = db
    .prepare('SELECT subject, status, assignee_id FROM tickets WHERE id = ?')
    .get(delivery.ticketId) as { subject: string; status: string; assignee_id: number | null };
  const tagNames = tagsForTicket(db, delivery.ticketId).map((tag) => tag.name);
  const sla = await getSla(delivery.ticketId);
  log.info(
    [
      `${delivery.filename}`,
      `  ticket #${delivery.ticketId} (${delivery.created ? 'new' : 'threaded onto existing'})`,
      `  subject  ${ticket.subject}`,
      `  status   ${ticket.status}, assignee ${ticket.assignee_id ?? 'none'}`,
      `  tags     ${tagNames.length > 0 ? tagNames.join(', ') : 'none'}`,
      `  sla      ${sla ? `${sla.state}, ${sla.remainingMinutes ?? '-'} business min left` : 'none'}`,
    ].join('\n'),
  );
}

closeLegacy();
db.close();
