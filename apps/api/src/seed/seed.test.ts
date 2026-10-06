import { copyFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

// Seed from a copy of the real inbox, leaving out mail dropped in with
// mail:drop. The test setup points the mailroom at a throwaway inbox.
const inbox = path.resolve(import.meta.dirname, '../../../../inbox');
const seedFiles = readdirSync(inbox).filter(
  (f) => /\.(json|eml)$/.test(f) && !f.startsWith('drop-'),
);
for (const file of seedFiles) {
  copyFileSync(path.join(inbox, file), path.join(process.env.MAILROOM_INBOX ?? '', file));
}

const { loadConfig } = await import('../config.ts');
const { openDatabase } = await import('../database.ts');
const { seedDatabase } = await import('./seed.ts');
const { ticketStates } = await import('./seed-data.ts');

const db = openDatabase(loadConfig().databasePath);
let created = 0;

beforeAll(async () => {
  created = await seedDatabase(db, new Date('2026-10-07T16:00:00Z'));
});

describe('seedDatabase', () => {
  it('ingests every message in the inbox', () => {
    const seen = db.prepare('SELECT count(*) AS n FROM mailroom_seen').get() as { n: number };
    expect(seen.n).toBe(seedFiles.length);
    expect(created).toBeGreaterThan(30);
  });

  it('has a state for every ticket the inbox opens', () => {
    // The first file for each ticket is the one that opened it.
    const rows = db
      .prepare('SELECT min(filename) AS filename FROM mailroom_seen GROUP BY ticket_id')
      .all() as Array<{ filename: string }>;
    const missing = rows.map((r) => r.filename).filter((f) => !(f in ticketStates));
    expect(missing).toEqual([]);
  });

  it('applies statuses, assignees, and tags', () => {
    const statuses = db
      .prepare('SELECT status, count(*) AS n FROM tickets GROUP BY status ORDER BY status')
      .all() as Array<{ status: string; n: number }>;
    expect(statuses.map((s) => s.status)).toEqual(['closed', 'open', 'pending']);
    const tagged = db.prepare('SELECT count(DISTINCT ticket_id) AS n FROM ticket_tags').get() as {
      n: number;
    };
    expect(tagged.n).toBeGreaterThan(10);
  });

  it('dates tickets relative to the seed time', () => {
    const newest = db.prepare('SELECT max(created_at) AS at FROM tickets').get() as { at: string };
    expect(newest.at).toBe('2026-10-07T15:30:00.000Z');
  });
});

describe('seeded Latin-1 subjects', () => {
  it('decodes the subject of ticket 36', () => {
    const row = db
      .prepare(
        `SELECT t.id, t.subject FROM tickets t
         JOIN mailroom_seen s ON s.ticket_id = t.id
         WHERE s.filename = ?`,
      )
      .get('0039-business-card-proofs-delivery.eml') as { id: number; subject: string };
    expect(row.id).toBe(36);
    expect(row.subject).toBe('Épreuves des cartes de visite : délai de livraison?');
  });
});
