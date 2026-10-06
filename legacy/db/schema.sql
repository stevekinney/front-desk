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
  status      TEXT NOT NULL DEFAULT 'open',
  state       TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  closed_at   TEXT
);

CREATE INDEX IF NOT EXISTS tickets_status ON tickets (status);

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

-- Replies wait here. In 2019 a cron job drained this into the mail server.
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

-- Business minutes from arrival to close, or to now for tickets still open.
CREATE VIEW IF NOT EXISTS sla_report AS
  SELECT t.id AS ticket_id,
         t.status,
         t.created_at,
         t.closed_at,
         business_minutes(
           t.created_at,
           coalesce(t.closed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ) AS business_minutes
    FROM tickets t;

-- Each stretch a ticket spent pending (waiting on the customer). The SLA clock
-- stops for the business minutes these intervals cover. An open stretch has no
-- ended_at.
CREATE TABLE IF NOT EXISTS ticket_pauses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES tickets (id),
  started_at  TEXT NOT NULL,
  ended_at    TEXT
);

CREATE INDEX IF NOT EXISTS ticket_pauses_ticket ON ticket_pauses (ticket_id);

-- Tickets that were already pending before pauses were recorded.
INSERT INTO ticket_pauses (ticket_id, started_at)
  SELECT id, updated_at FROM tickets t
   WHERE status = 'pending'
     AND NOT EXISTS (SELECT 1 FROM ticket_pauses p WHERE p.ticket_id = t.id AND p.ended_at IS NULL);

-- Files the poller has already turned into tickets.
CREATE TABLE IF NOT EXISTS mailroom_seen (
  filename    TEXT PRIMARY KEY,
  ticket_id   INTEGER REFERENCES tickets (id),
  ingested_at TEXT NOT NULL
);
