import { type Database } from '../database.ts';
import { migrateLegacy, pollInbox, sendReply } from '../legacy-adapter.ts';
import { STATE_FOR_STATUS } from '../tickets/tickets-repository.ts';
import { cannedReplies, tags, teammates, ticketStates, vipCustomers } from './seed-data.ts';

const HOUR = 60 * 60 * 1000;

/**
 * Fill an empty database: teammates, tags, and canned replies, then the
 * seeded inbox, then the state each conversation has reached.
 *
 * Ticket ages are relative to now, so SLA badges look the same no matter
 * when you reset.
 */
export async function seedDatabase(db: Database, now: Date = new Date()): Promise<number> {
  await migrateLegacy();

  const insertTeammate = db.prepare('INSERT OR IGNORE INTO teammates (name, email) VALUES (?, ?)');
  for (const teammate of teammates) insertTeammate.run(teammate.name, teammate.email);

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)');
  for (const tag of tags) insertTag.run(tag.name, tag.color);

  const insertCannedReply = db.prepare('INSERT INTO canned_replies (title, body) VALUES (?, ?)');
  for (const reply of cannedReplies) insertCannedReply.run(reply.title, reply.body);

  const deliveries = await pollInbox();

  const markVip = db.prepare('UPDATE customers SET vip = 1 WHERE email = ?');
  for (const email of vipCustomers) markVip.run(email);

  const teammateId = (key: string): number =>
    (
      db.prepare('SELECT id FROM teammates WHERE email = ?').get(`${key}@frontdesk.example`) as {
        id: number;
      }
    ).id;
  const tagId = (name: string): number =>
    (db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number }).id;

  for (const delivery of deliveries) {
    const state = ticketStates[delivery.filename];
    if (!state || !delivery.created) continue;
    const ticketId = delivery.ticketId;

    for (const reply of state.replies ?? []) {
      await sendReply({ ticketId, teammateId: teammateId(reply.from), body: reply.body });
    }
    for (const name of state.tags ?? []) {
      db.prepare('INSERT OR IGNORE INTO ticket_tags (ticket_id, tag_id) VALUES (?, ?)').run(
        ticketId,
        tagId(name),
      );
    }

    const createdAt = new Date(now.getTime() - state.ageHours * HOUR);
    const closedAt =
      state.status === 'closed'
        ? new Date(createdAt.getTime() + (state.closedAfterHours ?? 1) * HOUR)
        : null;
    const lastActivity =
      closedAt ?? new Date(createdAt.getTime() + Math.min(state.ageHours / 2, 24) * HOUR);
    db.prepare(
      `UPDATE tickets
          SET status = ?, state = ?, assignee_id = ?, created_at = ?, updated_at = ?, closed_at = ?
        WHERE id = ?`,
    ).run(
      state.status,
      STATE_FOR_STATUS[state.status],
      state.assignee ? teammateId(state.assignee) : null,
      createdAt.toISOString(),
      lastActivity.toISOString(),
      closedAt?.toISOString() ?? null,
      ticketId,
    );
    spreadMessages(db, ticketId, createdAt, lastActivity);
  }

  return deliveries.filter((delivery) => delivery.created).length;
}

/**
 * Space a ticket's messages out between its first and last activity. Seeded
 * replies answer the opening message, so they go before any follow-ups.
 */
function spreadMessages(db: Database, ticketId: number, from: Date, to: Date): void {
  const messages = db
    .prepare(
      `SELECT id FROM messages WHERE ticket_id = ?
        ORDER BY id = (SELECT min(id) FROM messages WHERE ticket_id = ?) DESC,
                 direction = 'outbound' DESC, id`,
    )
    .all(ticketId, ticketId) as Array<{ id: number }>;
  const span = Math.max(to.getTime() - from.getTime(), 0);
  const step = messages.length > 1 ? span / (messages.length - 1) : 0;
  const update = db.prepare('UPDATE messages SET created_at = ? WHERE id = ?');
  const updateOutbox = db.prepare('UPDATE outbox SET queued_at = ? WHERE message_id = ?');
  messages.forEach((message, index) => {
    const at = new Date(from.getTime() + step * index).toISOString();
    update.run(at, message.id);
    updateOutbox.run(at, message.id);
  });
}
