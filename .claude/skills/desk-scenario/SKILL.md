---
name: desk-scenario
description: Deliver sample emails to Front Desk and report the ticket each one became, with its threading, tags, assignee and SLA. Use to reproduce a bug or check a backlog item by hand on top of the seeded desk, or when the user asks to simulate incoming mail. Takes fixture names from fixtures/mail/, for example "refund-request poster-reprint-quote".
argument-hint: '[fixture ...]'
---

# Deliver sample mail

Fixtures to deliver: $ARGUMENTS

Fixtures live in `fixtures/mail/`. Run `ls fixtures/mail` to see them. If no fixture was named, ask which ones to send. Run every command from the repository root, in this checkout's environment (`PORT`, `FRONT_DESK_DB`, `MAILROOM_LOCK`).

Useful fixtures for the backlog:

| Item  | Fixture                                                          | What to look at                                   |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------- |
| FD-02 | `poster-reprint-quote`                                           | Its Latin-1 subject shows a replacement character |
| FD-09 | `refund-request`, `late-delivery`, `login-trouble`, `wrong-size` | Which category tag, if any, the new ticket gets   |

## Is the dev server running?

Check `curl -sf http://localhost:${PORT:-4100}/api/health`.

### Yes: use the API

For each fixture:

```sh
curl -s -X POST http://localhost:${PORT:-4100}/api/mail/simulate \
  -H 'Content-Type: application/json' -d '{"fixture":"<name>"}'
```

It drops the file, waits for the running mailroom to ingest it, and answers `{ filename, ticketId, created }`. Then fetch `GET /api/tickets/<ticketId>` for the subject, status, assignee, tags and SLA.

### No: drop and ingest once

```sh
npm run mail:drop -- <name>        # once per fixture
npx tsx .claude/skills/desk-scenario/ingest-once.mts
```

`ingest-once.mts` ingests everything new in the inbox through `apps/api/src/legacy-adapter.ts`, with the automation rules on, and prints each ticket it touched. If it exits 2, a poller holds the mailroom lock. Don't run it again; wait a few seconds and read the result from the API. Two pollers on one inbox ingest the same file twice (`docs/history/issues/97.md`).

If there is no database yet, run the `desk-setup` skill first.

## Report

For each fixture: the ticket number, whether it opened a new ticket or threaded onto an existing one, the subject as stored, the status and assignee, the tags, and the SLA state. Point out anything that relates to the backlog item being checked. Dropped files stay in `inbox/` as `drop-*` until the next reset.
