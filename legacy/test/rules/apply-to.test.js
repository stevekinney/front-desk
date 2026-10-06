import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';

import { all, createTeammate, migrate, run } from '../helpers.js';

const require = createRequire(import.meta.url);
const rules = require('../../rules');
const Customer = require('../../models/customer');
const Message = require('../../models/message');
const Ticket = require('../../models/ticket');

const applyTo = promisify(rules.applyTo);

beforeAll(async () => {
  await migrate();
  // The web API owns the tag tables; create them the way it does.
  await run(
    'CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, color TEXT NOT NULL)',
    [],
  );
  await run(
    'CREATE TABLE IF NOT EXISTS ticket_tags (ticket_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (ticket_id, tag_id))',
    [],
  );
  await run(
    "INSERT INTO tags (name, color) VALUES ('billing', '#2b6cb0'), ('urgent', '#c53030')",
    [],
  );
  await createTeammate('Priya Raman', 'priya@frontdesk.example');
});

/**
 * @param {{ email: string, vip?: number, subject: string, body: string, status?: string }} mail
 */
async function receive(mail) {
  const customer = await promisify(Customer.create)({ email: mail.email, vip: mail.vip ?? 0 });
  const ticket = await promisify(Ticket.create)({
    subject: mail.subject,
    customer_id: customer.id,
    status: mail.status ?? 'open',
  });
  const message = await promisify(Message.create)({
    ticket_id: ticket.id,
    direction: 'inbound',
    from_email: mail.email,
    body: mail.body,
  });
  return { ticket, message };
}

describe('applyTo', () => {
  it('runs the rules against the database', async () => {
    const { ticket, message } = await receive({
      email: 'vip@example.com',
      vip: 1,
      subject: 'Charged twice',
      body: 'My card was charged twice.',
    });

    await applyTo(ticket.id, message);

    const tags = await all(
      'SELECT g.name FROM ticket_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.ticket_id = ? ORDER BY g.name',
      [ticket.id],
    );
    expect(tags.map((t) => t.name)).toEqual(['billing', 'urgent']);
    const [row] = await all('SELECT assignee_id FROM tickets WHERE id = ?', [ticket.id]);
    expect(row.assignee_id).not.toBeNull();
  });

  it('reopens a ticket when the customer writes back', async () => {
    const { ticket, message } = await receive({
      email: 'waiting@example.com',
      subject: 'Proof question',
      body: 'Here is the file you asked for.',
      status: 'pending',
    });

    await applyTo(ticket.id, message);

    const [row] = await all('SELECT status FROM tickets WHERE id = ?', [ticket.id]);
    expect(row).toEqual({ status: 'open' });
  });
});
