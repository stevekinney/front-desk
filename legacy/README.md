# Mailroom

The mailroom has been running since 2019. It reads mail from the spool
directory, turns it into tickets, and keeps the SLA clock.

It predates the TypeScript API, and it's still the code that creates every
ticket.

## Layout

```
config.js        settings, read from the environment once at startup
db/              the database handle and schema
lib/model.js     a small active-record layer (see the header comment)
lib/cache.js     a process-wide memo cache
lib/sla.js       business-hours math and the per-ticket SLA summary
models/          one file per table
ingest/          parse inbox files, thread them onto tickets, poll the inbox
rules/           automation rules, run on incoming mail and hourly from cron
outbox/          replies
bin/mail-drop.js copy a sample message into the inbox
```

## Conventions

- CommonJS and Node-style callbacks: `function (err, result)`.
- Types live in JSDoc comments.
- Read and write tables through the models, so their save hooks run.

## Environment

| Variable            | Default                            |
| ------------------- | ---------------------------------- |
| `FRONT_DESK_DB`     | `data/front-desk.db`               |
| `MAILROOM_INBOX`    | `inbox`                            |
| `MAILROOM_FIXTURES` | `fixtures/mail`                    |
| `MAILROOM_POLL_MS`  | `2000`                             |
| `MAILROOM_LOCK`     | `$TMPDIR/front-desk-mailroom.lock` |
| `SUPPORT_ADDRESS`   | `help@frontdesk.example`           |

Relative paths resolve against the working directory of the process.
