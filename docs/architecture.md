# Architecture

Front Desk turns customer email into tickets. Teammates reply, tag, assign,
and close them in the web app.

```
inbox/ ──▶ legacy/ (mailroom) ──▶ data/front-desk.db ◀── apps/api ◀── apps/web
                                        ▲                    │
                                        └── legacy-adapter.ts┘
```

## The pieces

**`legacy/`, the mailroom (2019).** CommonJS with Node-style callbacks. It
polls `inbox/` every two seconds, parses each new file, threads it onto an
existing ticket or opens a new one, and records replies in the `outbox`
table. It also owns the SLA clock. It reads its configuration from the
environment once, when `legacy/config.js` is first required.

**`apps/api`, the TypeScript API (2025).** Express 5 on port 4100. Request
bodies are validated with zod, and response shapes come from
`packages/contract`. It runs the mailroom's poller in-process.

**`apps/web`, the React app (2026).** React 19 and React Router, served by
Vite on port 5173. Vite proxies `/api` to the API.

**`packages/contract`.** `openapi.yaml` is the source of truth for the HTTP
API. `npm run generate` turns it into `src/generated/schema.d.ts`, which both
the API and the web app import.

**`vendor/mailparse-lite`.** A vendored copy of a small RFC 822 parser. The
mailroom uses it for raw `.eml` files.

## Rules of the road

- **Only `apps/api/src/legacy-adapter.ts` imports from `legacy/`.** It turns
  callbacks into promises and gives the mailroom's objects TypeScript types.
  Everything else in the API, including `server.ts`, goes through it.
- **The API and the mailroom each hold their own SQLite connection** to the
  same file. The mailroom created most of the tables (`legacy/db/schema.sql`);
  the API owns `tags`, `ticket_tags`, and `canned_replies`
  (`apps/api/src/db/schema.sql`).
- **Run everything from the repository root.** The mailroom resolves `inbox/`
  and `data/` against the working directory.

## Mail

There is no mail server. Incoming mail is a file in `inbox/`: mostly JSON that
an old spool pre-processor already parsed, plus a few raw `.eml` files. The
poller never moves or deletes files; it records what it has ingested in the
`mailroom_seen` table.

- `npm run mail:drop -- <fixture>` copies a file from `fixtures/mail/` into
  `inbox/` as `drop-<timestamp>-<name>`. The "Simulate incoming email" button
  does the same thing.
- Replies are written to the `outbox` table. Nothing leaves the machine.

## Automation rules

The mailroom runs a small set of rules from `legacy/rules/` on every message it
ingests: reopening closed tickets when the customer writes back, tagging
billing questions, escalating VIP customers, assigning unassigned tickets in
turn, and closing tickets that have waited on the customer too long. The same
rules also run hourly from `legacy/bin/sweep-rules.js`.
Set `MAILROOM_RULES=off` to ingest mail without them; the test setups do.

Each rule has golden cases in `fixtures/rules/`. `npm run rules:parity` checks
the rules against them.

## SLA

Every ticket must be closed within **8 business hours** of arriving. Business
hours are 09:00 to 17:00, Monday to Friday, in the support desk's time zone
(America/New_York). There are no holidays.

The badge shows the business time remaining, or how far past due a ticket is.
Once a ticket is closed it shows whether the SLA was met.

## Data

- `data/front-desk.db` is created and seeded the first time the API starts.
- `npm run reset` deletes it, removes dropped mail from `inbox/`, and seeds
  again. Seeded ticket ages are relative to the moment you reset.
