# Front Desk

A tiny help desk. Customer emails become tickets; teammates reply, tag,
assign, and close them, and a badge counts down each ticket's SLA in business
hours.

Front Desk is the companion app for the
[AI Development Setup](https://stevekinney.com/courses/ai-development-setup) course. You've
inherited it. It works, people use it, and half of it was written in 2019 by
someone who has since moved on. The course isn't about writing its features
yourself: it's about building the setup that lets an AI coding assistant write
them safely.

## Start here

1. Clone the repository (use `git clone` or a fork, not "Use this template": the
   history matters) and install:

   ```sh
   npm install
   ```

2. Get a baseline before you change anything:

   ```sh
   npm run smoke
   ```

   It runs the unit tests the way CI does (`TZ=UTC`, shuffled order) and ends
   with `baseline: green except the items in KNOWN_FAILURES.md`. Anything
   listed in [KNOWN_FAILURES.md](KNOWN_FAILURES.md) was already failing before
   you got here.

3. Start the app:

   ```sh
   npm run dev
   ```

   Open http://localhost:5173. The inbox is seeded from the files in `inbox/`.
   Click "Simulate incoming email", or run `npm run mail:drop -- refund-request`,
   to have a new email arrive.

4. Pick up the backlog below. Each item has a spec in `specs/`, held-out
   acceptance tests in `acceptance/`, and an entry in `features.json`.
   `npm run feature:check -- <id>` runs an item's acceptance tests and is the
   only thing that marks it as passing.

There's no `.claude/` directory, `CLAUDE.md`, or any other assistant
configuration in this repository yet. Building that setup is the course.

## Backlog

| ID                        | Item                                    | Size | Lesson                                                                                                                                                                 |
| ------------------------- | --------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [FD-01](specs/FD-01.md) ★ | Tag counts in the sidebar               | S    | [Towards Systems Thinking → Start with a blank canvas](https://stevekinney.com/courses/ai-development-setup/why-systems#start-with-a-blank-canvas)                     |
| [FD-02](specs/FD-02.md)   | Latin-1 subjects are garbled            | S    | [The Enforcement Ladder → The rungs](https://stevekinney.com/courses/ai-development-setup/the-enforcement-ladder#the-rungs)                                            |
| [FD-03](specs/FD-03.md) ★ | CI is red, laptops are green            | S    | [Exemplar Subagents → Reenactor](https://stevekinney.com/courses/ai-development-setup/exemplar-subagents#reenactor)                                                    |
| [FD-04](specs/FD-04.md) ★ | Pending-customer pauses the SLA clock   | M    | [Deciding What to Build → Fault localization first](https://stevekinney.com/courses/ai-development-setup/patterns-for-deciding-what-to-build#fault-localization-first) |
| [FD-05](specs/FD-05.md) ★ | Create a ticket from the web            | M    | [Exemplar Skills → More to adapt](https://stevekinney.com/courses/ai-development-setup/exemplar-skills#more-to-adapt)                                                  |
| [FD-06](specs/FD-06.md)   | Ticket priority end to end              | M    | [Deciding What to Build → Research, plan, implement](https://stevekinney.com/courses/ai-development-setup/patterns-for-deciding-what-to-build#research-plan-implement) |
| [FD-07](specs/FD-07.md)   | Business-hours settings drive the SLA   | M    | [Exemplar Subagents → Junior engineer](https://stevekinney.com/courses/ai-development-setup/exemplar-subagents#junior-engineer)                                        |
| [FD-08](specs/FD-08.md) ★ | Port the automation rules to TypeScript | L    | [Running Unattended Work → Parallel worktree swarm](https://stevekinney.com/courses/ai-development-setup/patterns-for-running-unattended-work#parallel-worktree-swarm) |
| [FD-09](specs/FD-09.md) ★ | Auto-tag incoming mail                  | M    | [The Enforcement Ladder → Blast radius](https://stevekinney.com/courses/ai-development-setup/the-enforcement-ladder#blast-radius)                                      |
| [FD-10](specs/FD-10.md) ★ | Collapse `state` into `status`          | M    | [Exemplar Skills → Ticket dossier](https://stevekinney.com/courses/ai-development-setup/exemplar-skills#ticket-dossier)                                                |
| [FD-11](specs/FD-11.md) ★ | Merge duplicate tickets                 | L    | [Exemplar Skills → Interview to spec](https://stevekinney.com/courses/ai-development-setup/exemplar-skills#interview-to-spec)                                          |

★ marks the core items, the ones the course builds on. FD-01, FD-02 and FD-03
are independent of each other and of everything else, so they can be worked on
in parallel.

## Requirements

- Node 24.15 or later, installed however you like
- That's it: no Docker, no database server, no API keys, no network at runtime.

## Scripts

| Script                           | What it does                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                    | API on :4100 with the mailroom polling, web on :5173                           |
| `npm run check`                  | Lint, formatting, typecheck, generated-file drift, unit tests. CI runs this.   |
| `npm run smoke`                  | Unit tests as CI runs them, compared with `KNOWN_FAILURES.md`                  |
| `npm test`                       | Vitest: the `api`, `web`, and `legacy` projects, in default order              |
| `npm run feature:check -- <id>`  | Run a backlog item's acceptance tests and record the result in `features.json` |
| `npm run typecheck`              | TypeScript, every workspace                                                    |
| `npm run lint`                   | ESLint                                                                         |
| `npm run generate`               | Rebuild `packages/contract/src/generated/` from `openapi.yaml`                 |
| `npm run reset`                  | Fresh database, seeded from `inbox/`; removes dropped mail                     |
| `npm run mail:drop -- <name>`    | Copy a fixture from `fixtures/mail/` into `inbox/`                             |
| `npm run rules:parity -- [name]` | Check the automation rules against their golden cases in `fixtures/rules/`     |

`npm run check` and `npm run smoke` take `--seed <n>` (or `TEST_SEED=<n>`) to
replay a shuffled test order, and `--no-shuffle` / `--shuffle` to choose.

`npm run check` runs the tests in default order on your machine's time zone. CI
runs the same command with `TZ=UTC` and a shuffled order, and prints the seed
it used, so reproduce a CI run with `TZ=UTC TEST_SEED=<seed> npm run check`.
`npm run smoke` runs the tests the CI way and reports anything listed in
`KNOWN_FAILURES.md` as known; `npm run check` doesn't read that file, so a
known failure still turns it red.

## Configuration

Everything has a default, so none of these are required. Set them when you run
more than one copy of Front Desk at once (a second checkout or worktree, say),
because the copies otherwise share ports and the mailroom's lock.

| Variable             | Default                                          | What it controls                    |
| -------------------- | ------------------------------------------------ | ----------------------------------- |
| `PORT`               | `4100`                                           | API port; the web app proxies to it |
| `WEB_PORT`           | `5173`                                           | Web app port                        |
| `FRONT_DESK_DB`      | `data/front-desk.db`                             | SQLite database file                |
| `MAILROOM_INBOX`     | `inbox/`                                         | Folder the mailroom polls           |
| `MAILROOM_LOCK`      | `front-desk-mailroom.lock` in the OS temp folder | Only one mailroom polls per lock    |
| `MAILROOM_POLL_MS`   | `2000`                                           | How often the mailroom polls, in ms |
| `FINANCE_EXPORT_DIR` | `exports/`                                       | Where the nightly export writes     |

## Layout

```
apps/api            Express 5 API (TypeScript)
apps/web            React 19 app
packages/contract   openapi.yaml and the types generated from it
legacy              the 2019 mailroom (CommonJS)
vendor              third-party code we keep a copy of
inbox               incoming mail
fixtures/mail       sample mail for mail:drop
fixtures/rules      golden cases for the automation rules
ops                 the production crontab
docs                architecture notes and old issue history
specs               one spec per backlog item
acceptance          held-out acceptance tests, run by feature:check (not by npm test)
features.json       the backlog and which items pass
```

See [docs/architecture.md](docs/architecture.md) for how the pieces fit.
