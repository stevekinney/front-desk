import { describe, expect, it } from 'vitest';

import { all, migrate, run } from './helpers.js';

// A database from before FD-10: tickets still carry `state`. This file runs
// alone against its own database, so it can create the old shape first.
const OLD_TICKETS = `
  CREATE TABLE tickets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    subject     TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    assignee_id INTEGER,
    status      TEXT NOT NULL DEFAULT 'open',
    state       TEXT NOT NULL DEFAULT 'active',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    closed_at   TEXT
  )`;

describe('migrate', () => {
  it('drops tickets.state from an existing database without losing tickets', async () => {
    await run(OLD_TICKETS, []);
    const rows = [
      ['a', 'open', 'active', null],
      ['b', 'pending', 'on_hold', null],
      ['c', 'closed', 'resolved', '2026-10-01T15:00:00.000Z'],
    ];
    for (const [subject, status, state, closedAt] of rows) {
      await run(
        'INSERT INTO tickets (subject, customer_id, status, state, created_at, updated_at, closed_at) VALUES (?, 1, ?, ?, ?, ?, ?)',
        [subject, status, state, '2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z', closedAt],
      );
    }

    await migrate();
    await migrate();

    const columns = await all("SELECT name FROM pragma_table_info('tickets')", []);
    expect(columns.map((c) => c.name)).not.toContain('state');
    expect(columns.map((c) => c.name)).toContain('status');
    const tickets = await all('SELECT id, status, closed_at FROM tickets ORDER BY id', []);
    expect(tickets).toEqual([
      { id: 1, status: 'open', closed_at: null },
      { id: 2, status: 'pending', closed_at: null },
      { id: 3, status: 'closed', closed_at: '2026-10-01T15:00:00.000Z' },
    ]);

    // FD-06: the same upgrade adds priority, defaulting existing tickets to normal.
    expect(columns.map((c) => c.name)).toContain('priority');
    const priorities = await all('SELECT DISTINCT priority FROM tickets', []);
    expect(priorities).toEqual([{ priority: 'normal' }]);
    await expect(run("UPDATE tickets SET priority = 'critical'", [])).rejects.toThrow();
  });
});
