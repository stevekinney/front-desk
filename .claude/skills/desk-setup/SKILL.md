---
name: desk-setup
description: Get a fresh clone or a git worktree of Front Desk ready to work in. Checks Node, installs dependencies, gives a second checkout its own ports and mailroom lock, seeds the database if there isn't one, and records the test baseline. Use when starting in a new clone or worktree, or when the user asks to set up, initialize, or bootstrap the project.
---

# Set up Front Desk

Run every command from the repository root. The mailroom resolves `inbox/` and `data/` against the working directory. This skill doesn't start the dev server and doesn't delete anything.

## 1. Node

`node --version` must be at least the version in `.nvmrc` (24.15.0). The app uses `node:sqlite`. If it's older, stop and tell the user. Don't install or switch Node versions yourself.

## 2. Dependencies

Run `npm ci` if `node_modules/` is missing or `package-lock.json` is newer than `node_modules/.package-lock.json`. Otherwise skip it.

## 3. A second checkout needs its own ports and lock

By default every checkout uses API port 4100, web port 5173 and the lock `$TMPDIR/front-desk-mailroom.lock`. Two checkouts running at once collide: the second API can't listen, and its mailroom doesn't poll. The database (`data/front-desk.db`) is already separate per checkout.

This is a second checkout when `git rev-parse --git-dir` and `git rev-parse --git-common-dir` resolve to different paths. In that case, derive stable values from the checkout's path:

```sh
offset=$(( $(pwd | cksum | cut -d' ' -f1) % 800 + 1 ))
echo "export PORT=$((4100 + offset))"
echo "export WEB_PORT=$((5200 + offset))"
echo "export MAILROOM_LOCK=\"\${TMPDIR:-/tmp}/front-desk-$(basename "$(pwd)").lock\""
```

Nothing in the repository loads a `.env` file. Show the user the `export` lines. Then ask whether to also save them in `.claude/settings.local.json` under `"env"`, so every future session in this worktree gets them. Write that file only if they agree. Before writing it, make sure `.claude/settings.local.json` is git-ignored. Values in it apply from the next session, so export them in the shell for the rest of this one.

In the main checkout, skip this step.

## 4. Database

- If `data/front-desk.db` (or `$FRONT_DESK_DB`) doesn't exist, run `npx tsx .claude/skills/desk-reset/preflight.mts`. If it says `IDLE`, run `npm run reset` to seed. There is no database yet, so this only deletes `inbox/drop-*` files; if preflight listed any, ask before going ahead.
- If the database exists, leave it alone.

Either way, run `npx tsx .claude/skills/desk-reset/verify-seed.mts` and keep its output for the report. If the database existed already, a note that some tickets came from dropped mail is expected.

## 5. Baseline

```sh
npm run smoke
```

It runs the unit tests the way CI does (`TZ=UTC`, shuffled order) and compares failures with `KNOWN_FAILURES.md`. Exit 0 means "green except known failures". On exit 1, list the new failures and their seed (`npm run smoke -- --seed <n>` replays them). Don't try to fix them; this skill only records the baseline.

## 6. Report

- Node version, and whether dependencies were installed.
- Main checkout or second checkout, with the ports and lock it uses.
- Database path and tickets by status, from `verify-seed.mts`.
- The smoke result: known failures only, or the new failures.
- How to start: `npm run dev`, then open `http://localhost:<WEB_PORT>`.
