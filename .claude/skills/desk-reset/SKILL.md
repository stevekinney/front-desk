---
name: desk-reset
description: Delete this checkout's Front Desk database and reseed it from inbox/, after checking that nothing is using it, then verify the seed. Use when the user asks to reset, reseed, or start the desk over. Deletes files, so only the user starts it.
disable-model-invocation: true
---

# Reset the desk

`npm run reset` deletes `data/front-desk.db` (and its `-wal`/`-shm` files), deletes every `inbox/drop-*` file, and seeds again from `inbox/`. Run every command from the repository root, in this checkout's environment: if the session has `PORT`, `FRONT_DESK_DB`, `MAILROOM_LOCK` or `MAILROOM_INBOX` set, the scripts use them.

## 1. Preflight

```sh
npx tsx .claude/skills/desk-reset/preflight.mts
```

- Exit 2 (`BUSY`): stop here. Show the user the listed problems. Usually `npm run dev` is running; ask them to stop it. Never kill the process yourself. If the lock holder is running in a different checkout, say so: the two checkouts share a lock, and this one needs its own `MAILROOM_LOCK` (see `desk-setup`).
- Exit 0 (`IDLE`): continue.

## 2. Dropped mail

If preflight listed any `inbox/drop-*` files, ask the user whether to keep them. `npm run reset` deletes them.

- **Discard** (the reset's normal behavior): go on to step 3.
- **Keep**: before the reset, move them to `$TMPDIR/front-desk-drops-<timestamp>/`. After the reset, move them back into `inbox/`. Tell the user they aren't in the new database yet: the next poll (`npm run dev`, or `desk-scenario`'s `ingest-once.mts`) ingests them as new tickets with new numbers.

## 3. Reset

```sh
npm run reset
```

Note the `Seeded N tickets` line.

## 4. Verify

```sh
npx tsx .claude/skills/desk-reset/verify-seed.mts
```

It checks every inbox file was ingested, every ticket came from mail, the teammates, tags and canned replies match `apps/api/src/seed/seed-data.ts`, and every ticket has an SLA. Expected values come from the source files, so a change to the seed doesn't break the check. Exit 1 means a check failed: report which one and stop. Don't reset again to make it pass.

## 5. Report

- Tickets by status, from the verify output, and that the number matches `Seeded N`.
- What happened to dropped mail (discarded, or kept and waiting to be ingested).
- Seeded ticket ages restart from now, so SLA badges depend on the time of the reset.
- What wasn't checked: the web app and the API weren't started.
