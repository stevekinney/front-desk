import { DatabaseSync } from 'node:sqlite';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDesk, type Desk } from './support/desk.ts';
import { deskDay, runNightlyExport } from './support/export.ts';

// A database as it exists today: written before this change, with tickets in it.
function createExistingDatabase(file: string): void {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT NOT NULL UNIQUE,
      vip INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));
    CREATE TABLE tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL,
      customer_id INTEGER NOT NULL REFERENCES customers (id),
      assignee_id INTEGER, status TEXT NOT NULL DEFAULT 'open',
      state TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT);
    INSERT INTO customers (name, email) VALUES ('Old Customer', 'old@example.com');
    INSERT INTO tickets (subject, customer_id, status, state, created_at, updated_at)
      VALUES ('From before the change', 1, 'pending', 'on_hold',
              '2026-09-01T13:00:00.000Z', '2026-09-01T13:00:00.000Z');
  `);
  db.close();
}

let desk: Desk;

beforeAll(async () => {
  createExistingDatabase(process.env.FRONT_DESK_DB ?? '');
  desk = await createDesk();
});

function ticketColumns(): string[] {
  const rows = desk.db.prepare('PRAGMA table_info(tickets)').all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

describe('FD-10: one status column', () => {
  it('has no state column, in a database that already had one (1, 2)', () => {
    expect(ticketColumns()).toContain('status');
    expect(ticketColumns()).not.toContain('state');
  });

  it('keeps the tickets that were already there (2)', async () => {
    const res = await desk.get('/api/tickets/1').expect(200);
    expect(res.body).toMatchObject({ subject: 'From before the change', status: 'pending' });
  });

  it('still changes status through the API and through the mailroom (3)', async () => {
    const id = await desk.receive({ from: 'fd10@example.com', subject: 'Order 1' });
    expect((await desk.setStatus(id, 'closed').expect(200)).body).toMatchObject({
      status: 'closed',
    });
    await desk.receive({
      from: 'fd10@example.com',
      subject: `Re: Order 1 [#${id}]`,
      text: 'One more thing.',
    });
    const res = await desk.get(`/api/tickets/${id}`).expect(200);
    expect((res.body as { messageCount: number }).messageCount).toBe(2);
  });

  it('keeps every downstream report exactly as it was (4)', async () => {
    const closed = await desk.receive({ from: 'fd10-b@example.com', subject: 'Order 2' });
    const open = await desk.receive({ from: 'fd10-c@example.com', subject: 'Order 3' });
    await desk.setStatus(closed, 'closed').expect(200);

    const csv = runNightlyExport(deskDay());
    expect(csv.header).toEqual([
      'ticket_id',
      'customer_email',
      'customer_name',
      'subject',
      'state',
      'opened_at',
      'resolved_at',
      'business_minutes',
    ]);
    const ids = csv.rows.map((row) => Number(row.ticket_id));
    expect(ids).toContain(closed);
    expect(ids).not.toContain(open);
    expect(csv.rows.find((row) => Number(row.ticket_id) === closed)).toMatchObject({
      customer_email: 'fd10-b@example.com',
      subject: 'Order 2',
      state: 'resolved',
    });
  });
});
