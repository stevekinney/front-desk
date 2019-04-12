-- Mailroom schema. Every statement must be safe to run more than once.

CREATE TABLE IF NOT EXISTS teammates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  email      TEXT NOT NULL UNIQUE,
  vip        INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  subject     TEXT NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  assignee_id INTEGER REFERENCES teammates (id),
  state       TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  closed_at   TEXT
);

CREATE INDEX IF NOT EXISTS tickets_state ON tickets (state);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES tickets (id),
  direction   TEXT NOT NULL,
  author_id   INTEGER REFERENCES teammates (id),
  from_name   TEXT,
  from_email  TEXT NOT NULL,
  body        TEXT NOT NULL,
  message_id  TEXT UNIQUE,
  sent_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_ticket ON messages (ticket_id);

-- Replies wait here until the outbox job hands them to the mail server.
CREATE TABLE IF NOT EXISTS outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES tickets (id),
  message_id  INTEGER NOT NULL REFERENCES messages (id),
  to_address  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  queued_at   TEXT NOT NULL,
  sent_at     TEXT
);

-- Files the poller has already turned into tickets.
CREATE TABLE IF NOT EXISTS mailroom_seen (
  filename    TEXT PRIMARY KEY,
  ticket_id   INTEGER REFERENCES tickets (id),
  ingested_at TEXT NOT NULL
);
