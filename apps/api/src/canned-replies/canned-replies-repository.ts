import type { CannedReply } from '@front-desk/contract';

import type { Database } from '../database.ts';
import type { CannedReplyInput } from './canned-replies-schemas.ts';

interface CannedReplyRow {
  id: number;
  title: string;
  body: string;
}

function toCannedReply(row: CannedReplyRow): CannedReply {
  return { id: row.id, title: row.title, body: row.body };
}

export function listCannedReplies(db: Database): CannedReply[] {
  const rows = db
    .prepare('SELECT id, title, body FROM canned_replies ORDER BY title')
    .all() as unknown as CannedReplyRow[];
  return rows.map(toCannedReply);
}

export function findCannedReply(db: Database, id: number): CannedReply | null {
  const row = db.prepare('SELECT id, title, body FROM canned_replies WHERE id = ?').get(id) as
    CannedReplyRow | undefined;
  return row ? toCannedReply(row) : null;
}

export function createCannedReply(db: Database, input: CannedReplyInput): CannedReply {
  const result = db
    .prepare('INSERT INTO canned_replies (title, body) VALUES (?, ?)')
    .run(input.title, input.body);
  return { id: Number(result.lastInsertRowid), ...input };
}

/** What a template can refer to. */
export interface TemplateContext {
  customerName: string | null;
  ticketId: number;
  teammateName: string;
}

export function findTemplateContext(
  db: Database,
  ticketId: number,
  teammateId: number,
): TemplateContext | null {
  const ticket = db
    .prepare(
      `SELECT t.id, c.name AS customer_name
         FROM tickets t JOIN customers c ON c.id = t.customer_id
        WHERE t.id = ?`,
    )
    .get(ticketId) as { id: number; customer_name: string | null } | undefined;
  const teammate = db.prepare('SELECT name FROM teammates WHERE id = ?').get(teammateId) as
    { name: string } | undefined;
  if (!ticket || !teammate) return null;
  return { customerName: ticket.customer_name, ticketId: ticket.id, teammateName: teammate.name };
}
