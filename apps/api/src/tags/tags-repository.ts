import type { Tag, TagWithCount, TicketStatus } from '@front-desk/contract';

import type { Database } from '../database.ts';
import type { TagInput } from './tags-schemas.ts';

interface TagRow {
  id: number;
  name: string;
  color: string;
}

function toTag(row: TagRow): Tag {
  return { id: row.id, name: row.name, color: row.color };
}

/** Every tag with its ticket count. The status filter sits in the JOIN so empty tags stay. */
export function listTags(db: Database, status?: TicketStatus): TagWithCount[] {
  const rows = db
    .prepare(
      `SELECT g.id, g.name, g.color, count(t.id) AS ticket_count
         FROM tags g
         LEFT JOIN ticket_tags tt ON tt.tag_id = g.id
         LEFT JOIN tickets t ON t.id = tt.ticket_id AND (? IS NULL OR t.status = ?)
        GROUP BY g.id
        ORDER BY g.name`,
    )
    .all(status ?? null, status ?? null) as unknown as Array<TagRow & { ticket_count: number }>;
  return rows.map((row) => ({ ...toTag(row), ticketCount: row.ticket_count }));
}

export function findTag(db: Database, id: number): Tag | null {
  const row = db.prepare('SELECT id, name, color FROM tags WHERE id = ?').get(id) as
    TagRow | undefined;
  return row ? toTag(row) : null;
}

export function findTagByName(db: Database, name: string): Tag | null {
  const row = db.prepare('SELECT id, name, color FROM tags WHERE name = ?').get(name) as
    TagRow | undefined;
  return row ? toTag(row) : null;
}

export function createTag(db: Database, input: TagInput): Tag {
  const result = db
    .prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
    .run(input.name, input.color);
  return { id: Number(result.lastInsertRowid), name: input.name, color: input.color };
}

export function tagsForTicket(db: Database, ticketId: number): Tag[] {
  return tagsForTickets(db, [ticketId]).get(ticketId) ?? [];
}

/** Tags for many tickets in one query, keyed by ticket id. */
export function tagsForTickets(db: Database, ticketIds: number[]): Map<number, Tag[]> {
  const byTicket = new Map<number, Tag[]>();
  if (ticketIds.length === 0) return byTicket;
  const placeholders = ticketIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT tt.ticket_id, t.id, t.name, t.color
         FROM ticket_tags tt
         JOIN tags t ON t.id = tt.tag_id
        WHERE tt.ticket_id IN (${placeholders})
        ORDER BY t.name`,
    )
    .all(...ticketIds) as unknown as Array<TagRow & { ticket_id: number }>;
  for (const row of rows) {
    const list = byTicket.get(row.ticket_id) ?? [];
    list.push(toTag(row));
    byTicket.set(row.ticket_id, list);
  }
  return byTicket;
}

export function addTagToTicket(db: Database, ticketId: number, tagId: number): void {
  db.prepare('INSERT OR IGNORE INTO ticket_tags (ticket_id, tag_id) VALUES (?, ?)').run(
    ticketId,
    tagId,
  );
}

export function removeTagFromTicket(db: Database, ticketId: number, tagId: number): void {
  db.prepare('DELETE FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?').run(ticketId, tagId);
}
