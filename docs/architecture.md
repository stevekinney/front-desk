# Architecture

Front Desk turns customer email into tickets. Teammates reply, tag, assign,
and close them through the API.

```
inbox/ ──▶ legacy/ (mailroom) ──▶ data/front-desk.db ◀── apps/api
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

**`packages/contract`.** `openapi.yaml` is the source of truth for the HTTP
API. `npm run generate` turns it into `src/generated/schema.d.ts`, which the
API imports.

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
  `inbox/` as `drop-<timestamp>-<name>`. `POST /api/mail/simulate` does the
  same thing.
- Replies are written to the `outbox` table. Nothing leaves the machine.

## SLA

Every ticket must be closed within **8 business hours** of arriving. Business
hours are 09:00 to 17:00, Monday to Friday, in the support desk's time zone
(America/New_York). There are no holidays.

Every ticket the API returns carries its SLA: the business time remaining, or
how far past due it is. Once a ticket is closed it says whether the SLA was
met.

## Data

- `data/front-desk.db` is created the first time the API starts.
