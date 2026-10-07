# Front Desk

A small help desk. Customer email becomes tickets, and teammates reply to, tag, assign and close them. There are three generations of code, and all three share one SQLite file:

- `legacy/`: the 2019 mailroom. CommonJS, Node-style callbacks, types in JSDoc. It creates every ticket and owns the SLA clock.
- `apps/api/`: the 2025 Express 5 API in TypeScript, on :4100. It runs the mailroom's poller in-process.
- `apps/web/`: the 2026 React 19 app, served by Vite on :5173. Vite proxies `/api` to the API.
- `packages/contract/`: `openapi.yaml` and the types generated from it, which both apps import.

Read `docs/architecture.md` before changing how these pieces connect. Read `docs/history/issues/` before removing anything that looks unused.

## Commands

Run everything from the repository root. The mailroom resolves `inbox/` and `data/` against the working directory.

| When                              | Run                                                                   |
| --------------------------------- | --------------------------------------------------------------------- |
| Before any change, for a baseline | `npm run smoke`                                                       |
| Iterating on one test file        | `npx vitest run --project <api\|web\|legacy> <path>`                  |
| Before saying work is done        | `npm run check` (lint, format, typecheck, contract drift, unit tests) |
| Reproducing a CI failure          | `TZ=UTC TEST_SEED=<seed from the CI log> npm run check`               |
| Checking a backlog item           | `npm run feature:check -- FD-0N`                                      |
| Touching `legacy/rules/`          | `npm run rules:parity -- <rule-name>`                                 |
| After editing `openapi.yaml`      | `npm run generate`, then commit `src/generated/schema.d.ts`           |
| Fixing formatting                 | `npm run format`                                                      |

`npm run smoke` passes when every failure is listed in `KNOWN_FAILURES.md`. `npm run check` ignores that file, so a known failure still makes it red. Report that failure as known; don't treat it as one you caused.

Don't run these unless the user asks:

- `npm run reset`: deletes the database and every `inbox/drop-*` file, then reseeds.
- `npm run dev`: a long-running server. It holds the mailroom lock and ports 4100 and 5173.
- `npm run canary`.

## Definition of done

- `npm run check` passes, apart from failures listed in `KNOWN_FAILURES.md`. Name any of those that failed.
- New behavior has a unit test in the project it belongs to.
- For a backlog item, `npm run feature:check -- FD-0N` passes.
- If the contract changed, the regenerated `schema.d.ts` is part of the change.

## Rules for changes

**Boundaries**

- Only `apps/api/src/legacy-adapter.ts` may import from `legacy/`. To reach a new part of the mailroom, add a typed, promisified wrapper there.
- In `legacy/`, read and write tables through the models in `legacy/models/`, so their `beforeSave` and `afterSave` hooks run. Use CommonJS and callbacks there; don't add promises or ES modules.
- The API's endpoints must match `packages/contract/openapi.yaml`. Change the YAML first, run `npm run generate`, then implement. Never edit `src/generated/` by hand.
- Validate request bodies and params with zod, through `parse()` in `apps/api/src/http.ts`.

**Tickets: `status`**

- `tickets.status` (`open`, `pending`, `closed`) is the only status column. The old `state` column is gone, and nothing may write it. The nightly finance export (`legacy/export/nightly-csv.js`, run from `ops/crontab`) still emits a `state` column for finance's import, derived from `status` (`closed` becomes `resolved`). Keep its header and values unchanged. See issue #142.

- The mailroom caches each ticket's SLA under `sla:<id>` in `legacy/lib/cache.js`. Only `Ticket.afterSave` clears it. Any other write that changes a ticket's `status`, `created_at` or `closed_at` must clear that cache, or the SLA badge goes stale. The adapter doesn't expose a per-ticket clear yet. Add one to `legacy-adapter.ts` that calls `cache.del('sla:' + id)` (`legacy/lib/cache.js` exports `del`); don't use `closeLegacy()`, which shuts the mailroom down.

**Database**

- The mailroom's tables are in `legacy/db/schema.sql`. The API owns `tags`, `ticket_tags` and `canned_replies`, in `apps/api/src/db/schema.sql`.
- Both schema files run on every startup, so every statement must be safe to run twice. A change to an existing table must also migrate databases that already exist.
- The `sla_report` view calls `business_minutes()`. That SQL function is registered only on the mailroom's connection, so don't query the view from the API's connection.

**Mailroom config and time**

- `legacy/config.js` reads the environment once, when it's first required. In tests, set `FRONT_DESK_DB`, `MAILROOM_INBOX`, `MAILROOM_LOCK` and `MAILROOM_RULES` before anything loads the mailroom, as `apps/api/test/setup.ts` and `legacy/test/setup.js` do.
- SLA math uses business hours: 09:00 to 17:00, Monday to Friday, America/New_York, with no holidays. Get "now" from `legacy/lib/clock.js` in the mailroom so tests can freeze it. CI runs in `TZ=UTC`, so never depend on the machine's time zone.

**Vendored parser**

- `vendor/mailparse-lite/` is a patched copy with no upstream. Mark any change in `index.js` with a `front-desk patch N` comment and record it in `PATCHES.md`.

## Tests

- There are three Vitest projects: `api` (node), `web` (jsdom) and `legacy` (node). Tests sit next to the code (`*.test.ts`, `*.test.tsx`), except in `legacy/test/`.
- Each test file gets a throwaway database, inbox and lock from its project's `test/setup` file. Don't point a test at `data/` or the real `inbox/`.
- CI shuffles test order. Don't keep state at module level that leaks between tests (see `legacy/rules/assign-round-robin.js`). If a test fails only in some orders, replay it with `npm run smoke -- --seed <n>`.
- `acceptance/` holds the held-out tests for the backlog in `specs/`. `npm test` doesn't run them. Don't edit `acceptance/`, `specs/` or the `passes` field in `features.json` to make an item pass. Only `npm run feature:check` sets `passes`.
- When you fix a test listed in `KNOWN_FAILURES.md`, remove its entry in the same change.

## Style

- Prettier settings: single quotes, trailing commas, 100-column lines. ESLint covers TypeScript, React hooks and the legacy CommonJS.
- TypeScript is strict, with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. Write relative imports with their `.ts` or `.tsx` extension, and use `import type` for types.
- In `apps/api/src/` and `apps/web/src/`, put code in one folder per feature (`tickets/`, `tags/`, …). In the API that means a router, schemas, a repository and a test; in the web app, a `*-api.ts` file next to the components.
- Match the comment style around you: a short header comment that says why the file exists, and no comments that restate the code.

## Running two copies at once

A second checkout or worktree must set its own `PORT`, `WEB_PORT` and `MAILROOM_LOCK`. Otherwise the two copies fight over the ports and the mailroom lock. Nothing loads a `.env` file.
