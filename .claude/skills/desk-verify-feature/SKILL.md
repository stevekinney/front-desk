---
name: desk-verify-feature
description: Start Front Desk's dev server if it isn't already up, click through a feature or bug fix in a real browser with playwright-cli, and once it visibly works, lock it in with a Vitest test in the owning project and a Playwright spec in e2e/. Use when the user asks to try, click through, QA, smoke-test, manually test or "see it working" in the browser or UI, to check that a change or backlog item (FD-0N) actually works for a teammate, or to write end-to-end, browser or Playwright tests for something just built. Use it even when the user only says "make sure it works" after a UI or API change.
argument-hint: '[feature, bug or FD-0N]'
---

# Verify a feature in the browser, then lock it in

What to verify: $ARGUMENTS

Work in this order: see it working, then write the tests. A test written from reading the code checks what the code does. A test written from watching the app checks what a teammate sees, and the manual pass hands you the exact roles and labels the tests need.

Running this skill counts as the user asking for the dev server, which CLAUDE.md otherwise keeps off limits. Run every command from the repository root.

## 1. Decide what "works" means

- For a backlog item, the acceptance criteria in `specs/FD-0N.md` are the source of truth. Don't write the checklist from `acceptance/`: those tests are held out.
- Otherwise use the user's description, plus `git status` and `git diff main...HEAD` to see what changed.
- Write a short checklist of things a teammate would see or do. Add one or two edges that this change could plausibly break, such as an empty list, an API error, a reload (does it persist?), another status filter, or another teammate in "Signed in as". Leave out anything the change doesn't touch.

## 2. Bring up the dev server

```sh
npx tsx .claude/skills/desk-verify-feature/dev-up.mts
```

| Result            | Meaning                                              | Do                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNNING`, exit 0 | This checkout's server was already up                | Use the `web:` URL. You'll leave it running at the end.                                                                                                                      |
| `STARTED`, exit 0 | The script started it, detached                      | Use the `web:` URL. `dev-down.mts` stops it at the end.                                                                                                                      |
| `BLOCKED`, exit 2 | Another checkout holds the port or the mailroom lock | Never stop the other process. If this is a worktree, use `desk-setup`'s `PORT`, `WEB_PORT` and `MAILROOM_LOCK` and prefix every command in this skill with them (see below). |
| `FAILED`, exit 1  | It started but didn't answer within 60 seconds       | Read the log tail it printed. It's usually a compile error in `apps/api/src/`.                                                                                               |

Shell variables don't carry over between Bash calls, so in a worktree put the values on each command that needs them: `PORT=4446 WEB_PORT=5546 MAILROOM_LOCK=/tmp/front-desk-<worktree>.lock npx tsx …`. That covers `dev-up`, `dev-down`, `curl` and `npm run e2e`.

If there's no database yet, the API seeds one on first start: 38 tickets, four teammates, tags and canned replies.

The API runs under `tsx watch`, so every edit in `apps/api/src/` restarts it. After an API edit, run `dev-up.mts` again before the next browser step; it waits until `/api/health` answers. Vite hot-reloads web edits, but `goto` the page again so you start from a clean state.

## 3. Set up the data

The seeded desk has tickets in every status. To create a new ticket, deliver a fixture from `fixtures/mail/` through the running API:

```sh
curl -s -X POST http://localhost:${PORT:-4100}/api/mail/simulate \
  -H 'Content-Type: application/json' -d '{"fixture":"wrong-size"}'
# → {"filename":"drop-…","ticketId":39,"created":true}
```

`created: false` means the mail threaded onto an existing ticket. While the dev server is up, don't use `npm run mail:drop` with `ingest-once.mts`: two pollers on one inbox ingest the same file twice (`docs/history/issues/97.md`).

Make a fresh ticket for anything you're going to change, so your changes are easy to tell apart. Keep a list of everything you change (tickets created, status changes, replies, tags, assignments). It goes in the report, because it all lands in this checkout's `data/front-desk.db`.

## 4. Click through it

Use `playwright-cli` with a named session so parallel jobs don't share a browser. Keep the name short: the session's socket lives under `$TMPDIR`, and a long name fails with `listen EINVAL` on macOS. Use `fd-<API port>`:

```sh
playwright-cli -s=fd-4100 open http://localhost:5173    # the web URL, not the API: Vite proxies /api
playwright-cli -s=fd-4100 snapshot                      # roles, accessible names and refs (e14)
playwright-cli -s=fd-4100 click e14
playwright-cli -s=fd-4100 fill e31 "A replacement is on its way."
playwright-cli -s=fd-4100 select e6 "Priya Raman"
playwright-cli -s=fd-4100 goto http://localhost:5173/tickets/39
playwright-cli -s=fd-4100 console error                 # ignore the favicon.ico 404
playwright-cli -s=fd-4100 network                       # look for 4xx/5xx on /api
playwright-cli -s=fd-4100 screenshot
```

- Refs change after every action. Take a new snapshot before each click. To keep the output small, pass `--depth` or a ref to snapshot one region.
- For each checklist item, act, then check the page shows what a teammate should see. "No error" isn't a pass. If the UI says something was saved, prove it: reload, or `curl /api/tickets/<id>`.
- After each step, check `console error` and `network`.
- Screenshot the states that matter, and keep the paths for the report.
- Write down the role and accessible name of every element you used, for example `button "Waiting on customer"` or `combobox "Signed in as"`. Those become the test locators.

When something doesn't work, that's the finding. If the user asked you to build or fix it, fix the code and repeat the step. If not, stop and report what you saw. Don't write tests around broken behavior.

## 5. Write the tests

Write tests only for behavior you watched work. There are two layers, and they do different jobs.

### Vitest, in the project that owns the change

This layer is part of the definition of done, and `npm run check` runs it. It covers the permutations: every status, empty and error states, and SLA math with a frozen clock.

| What changed      | Test file                                     | Use                                                                                                                                                                   |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web UI            | `apps/web/src/<feature>/<component>.test.tsx` | `mockApi()`, `makeTicket()`, `makeTicketDetail()`, `priya` and `dana` from `apps/web/test/mock-api.ts`; `renderApp(url)` from `apps/web/test/render.tsx`; `userEvent` |
| API endpoint      | `apps/api/src/<feature>/<feature>.test.ts`    | `createTestDesk()` from `apps/api/test/helpers.ts`, with `supertest`                                                                                                  |
| Mailroom or rules | `legacy/test/…`                               | the setup in `legacy/test/setup.js`                                                                                                                                   |

Read a neighboring test first and match it. To translate the session:

- A snapshot line becomes a query. `button "Waiting on customer"` becomes `screen.getByRole('button', { name: 'Waiting on customer' })`.
- A request you saw in `network` becomes a mock: `mockApi().on('PATCH', '/tickets/1/status', makeTicket({ status: 'pending' }))`. Paths are relative to `/api` and must match the query string exactly. An unmocked call returns 404, which is how you find the calls you forgot.

### Playwright, in `e2e/`

This layer proves the real UI, API and mailroom work together. Cover the main path, plus one edge if it matters.

- Use one spec per feature: `e2e/<feature>.spec.ts`. `e2e/inbox.spec.ts` shows the shape.
- `npm run e2e` starts its own API and web server on `PORT + 10000` and `WEB_PORT + 10000`, against a throwaway desk seeded from `inbox/`. It runs alongside the dev server and never touches `data/`.
- Set up data through the API with `deliverMail(request, '<fixture>')` and `getTicket(request, id)` from `e2e/support/desk.ts`. Then drive only the UI under test.
- Every spec shares one desk and they run one at a time. Change only tickets the test created, and don't assert counts of seeded data, because another spec may have changed them.
- Don't assert SLA wording such as "Due in 5h". Seeded ages are relative to now and business hours depend on the wall clock. The Vitest layer covers that with a frozen clock.
- Use `getByRole`, `getByLabel` and `getByText` with the names from your session. Never use snapshot refs or CSS classes.

Never write into `acceptance/`, `specs/` or `features.json`.

## 6. Prove the tests

```sh
npx vitest run --project web apps/web/src/<feature>/<file>.test.tsx   # or --project api / legacy
npm run e2e -- e2e/<feature>.spec.ts
```

Then show that each new test can fail. Briefly undo the line that makes the feature work, or flip the key expectation, and watch the test fail for the right reason. Then put it back. A test you never saw fail proves nothing.

Finish with `npm run check`. If a failure is listed in `KNOWN_FAILURES.md`, name it as known. For a backlog item, also run `npm run feature:check -- FD-0N`.

## 7. Clean up

```sh
playwright-cli -s=fd-4100 close
npx tsx .claude/skills/desk-verify-feature/dev-down.mts
```

`dev-down.mts` stops only a server that `dev-up.mts` started. If the server was already up when you began, it prints `NOTHING TO STOP` and leaves it running. Don't stop that one any other way.

## 8. Report

- **Checklist**: each behavior, pass or fail, and the evidence: what the page showed, and screenshot paths.
- **Bugs**: what was broken, and whether you fixed it.
- **Tests**: the files you added, the commands you ran and their results, including the check that each test can fail.
- **Checks**: the `npm run check` result, naming known failures, and `feature:check` for a backlog item.
- **Desk changes**: what the session changed in `data/front-desk.db`, and any `inbox/drop-*` files left behind. The user can start over with `/desk-reset`, which only they can run.
- **Dev server**: stopped (this skill started it), or left running (it was already up).
