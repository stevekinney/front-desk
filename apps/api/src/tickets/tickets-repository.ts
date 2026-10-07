import type { Message, Tag, Ticket, TicketPriority, TicketStatus } from '@front-desk/contract';

import { now, type Database } from '../database.ts';
import { tagsForTickets } from '../tags/tags-repository.ts';
import type { ListTicketsQuery } from './tickets-schemas.ts';

/** A ticket as stored, before the SLA summary is attached. */
export type TicketRecord = Omit<Ticket, 'sla'>;

interface TicketRow {
  id: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  customer_id: number;
  customer_name: string | null;
  customer_email: string;
  customer_vip: number;
  assignee_id: number | null;
  assignee_name: string | null;
  assignee_email: string | null;
  message_count: number;
}

const SELECT_TICKETS = `
  SELECT t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at, t.closed_at,
         c.id AS customer_id, c.name AS customer_name, c.email AS customer_email,
         c.vip AS customer_vip,
         tm.id AS assignee_id, tm.name AS assignee_name, tm.email AS assignee_email,
         (SELECT count(*) FROM messages m WHERE m.ticket_id = t.id) AS message_count
    FROM tickets t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN teammates tm ON tm.id = t.assignee_id`;

function toRecord(row: TicketRow, tags: Tag[]): TicketRecord {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      email: row.customer_email,
      vip: row.customer_vip === 1,
    },
    assignee:
      row.assignee_id === null
        ? null
        : { id: row.assignee_id, name: row.assignee_name ?? '', email: row.assignee_email ?? '' },
    tags,
    messageCount: row.message_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

export function listTicketRecords(db: Database, query: ListTicketsQuery): TicketRecord[] {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.status) {
    where.push('t.status = ?');
    params.push(query.status);
  }
  if (query.priority) {
    where.push('t.priority = ?');
    params.push(query.priority);
  }
  if (query.assigneeId) {
    where.push('t.assignee_id = ?');
    params.push(query.assigneeId);
  }
  if (query.tag) {
    where.push(
      'EXISTS (SELECT 1 FROM ticket_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.ticket_id = t.id AND g.name = ?)',
    );
    params.push(query.tag);
  }
  const sql = `${SELECT_TICKETS} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY t.updated_at DESC, t.id DESC`;
  const rows = db.prepare(sql).all(...params) as unknown as TicketRow[];
  const tags = tagsForTickets(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toRecord(row, tags.get(row.id) ?? []));
}

export function findTicketRecord(db: Database, id: number): TicketRecord | null {
  const row = db.prepare(`${SELECT_TICKETS} WHERE t.id = ?`).get(id) as TicketRow | undefined;
  if (!row) return null;
  return toRecord(row, tagsForTickets(db, [id]).get(id) ?? []);
}

export function ticketExists(db: Database, id: number): boolean {
  return db.prepare('SELECT 1 FROM tickets WHERE id = ?').get(id) !== undefined;
}

export function teammateExists(db: Database, id: number): boolean {
  return db.prepare('SELECT 1 FROM teammates WHERE id = ?').get(id) !== undefined;
}

export function assignTicket(db: Database, ticketId: number, teammateId: number | null): void {
  db.prepare('UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id = ?').run(
    teammateId,
    now(),
    ticketId,
  );
}

export function setTicketPriority(db: Database, ticketId: number, priority: TicketPriority): void {
  db.prepare('UPDATE tickets SET priority = ?, updated_at = ? WHERE id = ?').run(
    priority,
    now(),
    ticketId,
  );
}

interface MessageRow {
  id: number;
  direction: Message['direction'];
  author_id: number | null;
  author_name: string | null;
  author_email: string | null;
  from_name: string | null;
  from_email: string;
  body: string;
  sent_at: string | null;
  created_at: string;
  outbox_to: string | null;
  outbox_subject: string | null;
  outbox_queued_at: string | null;
}

const SELECT_MESSAGES = `
  SELECT m.id, m.direction, m.author_id, tm.name AS author_name, tm.email AS author_email,
         m.from_name, m.from_email, m.body, m.sent_at, m.created_at,
         o.to_address AS outbox_to, o.subject AS outbox_subject, o.queued_at AS outbox_queued_at
    FROM messages m
    LEFT JOIN teammates tm ON tm.id = m.author_id
    LEFT JOIN outbox o ON o.message_id = m.id`;

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    direction: row.direction,
    author:
      row.author_id === null
        ? null
        : { id: row.author_id, name: row.author_name ?? '', email: row.author_email ?? '' },
    fromName: row.from_name,
    fromEmail: row.from_email,
    body: row.body,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    delivery:
      row.outbox_to === null
        ? null
        : {
            to: row.outbox_to,
            subject: row.outbox_subject ?? '',
            queuedAt: row.outbox_queued_at ?? row.created_at,
          },
  };
}

export function listMessages(db: Database, ticketId: number): Message[] {
  const rows = db
    .prepare(`${SELECT_MESSAGES} WHERE m.ticket_id = ? ORDER BY m.created_at, m.id`)
    .all(ticketId) as unknown as MessageRow[];
  return rows.map(toMessage);
}

export function findMessage(db: Database, id: number): Message | null {
  const row = db.prepare(`${SELECT_MESSAGES} WHERE m.id = ?`).get(id) as MessageRow | undefined;
  return row ? toMessage(row) : null;
}
