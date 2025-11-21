-- Tables owned by the TypeScript API. The mailroom owns the rest
-- (legacy/db/schema.sql). Every statement must be safe to run more than once.

CREATE TABLE IF NOT EXISTS tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_tags (
  ticket_id INTEGER NOT NULL REFERENCES tickets (id),
  tag_id    INTEGER NOT NULL REFERENCES tags (id),
  PRIMARY KEY (ticket_id, tag_id)
);

CREATE TABLE IF NOT EXISTS canned_replies (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body  TEXT NOT NULL
);
