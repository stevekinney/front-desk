# Front Desk backlog roadmap

Triage of FD-01 to FD-11 at commit `bdaca5e`, 6 October 2026. This file is local working material and isn't committed.

Each item went through the same steps:

1. An investigator traced the spec to the code and wrote a root-cause analysis and plan to `tmp/plans/FD-XX.md`.
2. The junior-engineer agent reviewed each plan cold. A reviser answered its questions from the code and wrote product decisions up as open questions with an assumption. This repeated until junior-engineer reported no blocking questions. Every plan got there in one or two rounds.
3. The reenactor agent wrote the smallest failing test in its own git worktree. FD-03 is the exception: its failing test already exists on `main`.
4. A separate verifier checked four things: the test fails, it fails for the predicted reason, only test files changed, and the rest of its Vitest project still passes. Then every test was run again by hand after the workflow finished.

**Ground rules:** no agent opened `acceptance/` or `features.json`. They are held-out tests, so every failing test here comes from `specs/` and the code alone. Nothing was committed, and no source file was changed.

## At a glance

| Item  | Title                                   | Kind                | Failing test                                           | Open questions |
| ----- | --------------------------------------- | ------------------- | ------------------------------------------------------ | -------------- |
| FD-01 | Tag counts in the sidebar               | missing feature     | `GET /api/tags` has no `ticketCount`                   | 4              |
| FD-02 | Latin-1 subjects are garbled            | bug                 | Subject decodes to `r�impression`                      | 0              |
| FD-03 | CI is red, laptops are green            | test infrastructure | Existing round-robin test, shuffle seed 2              | 3              |
| FD-04 | Pending-customer pauses the SLA clock   | missing feature     | Pending ticket's SLA is `on-track`, not `paused`       | 6              |
| FD-05 | Create a ticket from the web            | missing feature     | `POST /api/tickets` returns 404                        | 0              |
| FD-06 | Ticket priority end to end              | missing feature     | Ticket has no `priority`                               | 8              |
| FD-07 | Business-hours settings drive the SLA   | missing feature     | Settings endpoint returns 404                          | 4              |
| FD-08 | Port the automation rules to TypeScript | missing feature     | None of the five rules exists in `apps/api/src/rules/` | 5              |
| FD-09 | Auto-tag incoming mail                  | missing feature     | Shipping mail gets no `shipping` tag                   | 0              |
| FD-10 | Collapse `state` into `status`          | missing feature     | Migrated `tickets` still has a `state` column          | 0              |
| FD-11 | Merge duplicate tickets                 | missing feature     | `POST /api/tickets/{id}/merge` returns 404             | 9              |

## Suggested order

1. **FD-03** first. It is a test-only change, and it turns CI green, so every later branch gets a meaningful CI run.
2. **FD-02** and **FD-01** can go in parallel at any point. Neither touches the SLA, the schema or the rules.
3. **FD-04** next among the SLA and schema items. It introduces two things the others need (see below): a per-ticket SLA cache clear in the adapter, and the first guarded migration in `migrate()`.
4. **FD-05**, **FD-06**, **FD-10**, then **FD-07**. They all change the tickets schema or the SLA, and they should land one at a time on top of FD-04's migration pattern. FD-10 and FD-06 both change the finance export, so do them back to back with one note to finance.
5. **FD-08** after FD-03. The TypeScript port has to mirror the module-level round-robin rotation that FD-03's test fix works around. **FD-09** is independent of FD-08, but agree on whether FD-08 ports the new `auto-tag` rule too.
6. **FD-11** last. It is the largest item, has the most open questions, and builds on FD-04's cache clear and FD-05's ticket-creation path.

## Findings that span several items

- **The API leaves the SLA cache stale.** `setTicketStatus` ([`tickets-repository.ts:108`](../apps/api/src/tickets/tickets-repository.ts)) changes status with plain SQL, and only `Ticket.afterSave` clears the mailroom's `sla:<id>` cache. FD-04's test proves the badge shows the old status after any read. Add one `clearSlaCache(id)` wrapper to `legacy-adapter.ts` as part of FD-04; FD-07 and FD-11 both need it.
- **The 17:00 hour counts as business time.** `isBusinessHour` ([`legacy/lib/sla.js:54`](../legacy/lib/sla.js)) uses `hour <= closeHour`, so one business day is 540 minutes, not 480. I confirmed it: Monday 09:00 to Tuesday 09:00 in New York gives 540. FD-07 also found that the code steps in whole UTC hours, so half-hour time zones miscount. FD-04 and FD-07 both plan to fix the 17:00 bug. Pick one owner; FD-04's plan assumes it does. The fix moves some tickets between met and missed, and lowers the export's `business_minutes`. Finance should hear about it.
- **Four items add migrations to the same function.** FD-04 (`paused_at`), FD-06 (`priority`), FD-10 (drop `state`) and FD-11 (a merge table) all extend `migrate()` in [`legacy/db/connection.js`](../legacy/db/connection.js). `ALTER` and `DROP` can't go in `schema.sql`, because it runs on every startup and the second run fails. Land a guarded-migration helper with the first item, and have the rest reuse it.
- **Cron jobs never migrate.** `nightly-csv.js` and `sweep-rules.js` run in their own processes on mail-01 and don't call `migrate()`. If new code that reads a new column runs before the API restarts, the 02:15 export fails and finance gets no file. That is issue #142 again. It affects FD-06, FD-10 and FD-11.
- **The finance export changes in three items.** FD-06 appends a `priority` column, FD-07's hour fix changes `business_minutes`, and FD-10 must derive `state` from `status` byte for byte. In issue #142, finance asked for format changes in writing.
- **Three items add tests to the same file.** FD-04, FD-05 and FD-06 all add their failing tests to `apps/api/src/tickets/tickets.test.ts`, so expect merge conflicts. Keep each in its own `describe` block.
- **Held-out typecheck.** `npm run typecheck` also typechecks `acceptance/`. Contract names were chosen without reading the held-out tests: the shape of `ticketCount` in FD-01, and `TicketPriority` and `updateTicketPriority` in FD-06. The first `npm run feature:check` will show whether they match.
- **Housekeeping.** Neither `tmp/` nor `.claude/worktrees/` is git-ignored, so `npm run check`'s Prettier step scans both. I ran Prettier on `tmp/plans/` so it stays clean. Remove the worktrees once their tests have moved onto real branches.

## FD-01: Tag counts in the sidebar

**Kind:** missing-feature · **Size:** S · ★ core · **Plan:** [`tmp/plans/FD-01.md`](plans/FD-01.md) · **Spec:** [`specs/FD-01.md`](../specs/FD-01.md)

**Plan review:** 2 junior-engineer round(s), ready with 0 blocking questions (6 non-blocking notes left in the plan) · **Failing test:** verified on attempt 1 of 1

FD-01 is missing in every layer. GET /api/tags ignores its query string and returns only id, name and color. The contract has no ticketCount and no status parameter. The inbox Tags sidebar fetches /tags once under a fixed key and has no idea which status the inbox is showing. The feature only reads data, so none of the status/state, SLA cache, adapter, crontab or export traps apply; the real traps are the contract shape (acceptance/ is typechecked against it), the zero-count SQL case, and the web test mocks and link names that change.

### Root cause

Nothing computes or exposes per-tag ticket counts. (1) Contract: in openapi.yaml, GET /tags (listTags, lines 220-231) has no parameters and no 400 response. Tag (lines 406-416) has no ticketCount, and Tag is also embedded in Ticket.tags and in the POST /tags and per-ticket tag responses. The generated operations.listTags query is `never`. (2) API: tags-router.ts:22 uses `(_req, res)` and never parses req.query, so ?status=bogus returns 200. tags-repository.ts:16-21 selects only id, name and color. tags-schemas.ts has no query schema. (3) Web: tags-api.ts listTags() always requests /tags. tag-sidebar.tsx:9 uses useApi(listTags, 'tags'), whose fixed key means switching status never refetches. The sidebar renders only the dot and the name (:26-27). inbox-page.tsx:58 renders <TagSidebar /> without the status it already computes at :24. The fix is to add a status param, a 400 response and a ticketCount field to the contract and regenerate the types. Then add a zod listTagsQuerySchema parsed via parse(), and a correlated-subquery count in listTags (so tags with 0 tickets stay in the list). Finally, add listTagCounts(status) on the web side and pass status into TagSidebar, keyed by status, to render "name N".

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-36` on branch `worktree-wf_b6af7eba-389-36` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-36/apps/api/src/tags/tags.test.ts`](../.claude/worktrees/wf_b6af7eba-389-36/apps/api/src/tags/tags.test.ts)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project api src/tags/tags.test.ts -t "counts tickets per tag"
  ```

- **Observed on main:** 1 failed | 6 skipped — `expected undefined to be 2`
- **Why that is the right failure:** On main: `AssertionError: expected undefined to be 2` at the first count('') assertion. listTags (apps/api/src/tags/tags-repository.ts:16-21) selects only id, name and color, so ticketCount is absent. That is the spec gap in criterion 4, not a type or import error: the local `Counted = Tag & { ticketCount?: number }` type keeps the file valid, and vitest does not typecheck. If counts were implemented without query validation, the test would instead fail at the bogus line with `expected 400 "Bad Request", got 200 "OK"` (criterion 5).

### Where the fix goes

- [`apps/api/src/tags/tags-repository.ts:16`](../apps/api/src/tags/tags-repository.ts) — Execution path of the failing request (inference): listTags runs `SELECT id, name, color FROM tags ORDER BY name` (lines 16-21) and maps the rows through toTag (lines 12-14), so ticketCount is never computed. This is the direct cause of `expected undefined to be 2`.
- [`apps/api/src/tags/tags-router.ts:22`](../apps/api/src/tags/tags-router.ts) — Execution path (inference): the GET /tags handler is `(_req, res)` and never parses req.query. That means no status scoping (criterion 4) and no 400 for `?status=bogus` or a repeated status (criterion 5).
- [`apps/api/src/tags/tags-schemas.ts`](../apps/api/src/tags/tags-schemas.ts) — Execution path (inference): there is no query schema for listTags that parse() in apps/api/src/http.ts could use to reject unknown or repeated status values with an `issues` array.
- [`packages/contract/openapi.yaml:220`](../packages/contract/openapi.yaml) — Contract (inference): GET /tags (lines 220-231) has no status parameter and no 400 response, and Tag (lines 406-416) has no ticketCount. The generated packages/contract/src/generated/schema.d.ts:611-617 has listTags query typed as `never` (criterion 6).
- [`apps/web/src/tags/tag-sidebar.tsx:9`](../apps/web/src/tags/tag-sidebar.tsx) — Not exercised by this test (inference, criteria 1-3): useApi(listTags, 'tags') uses a fixed key and renders only the dot and the name (lines 26-27). apps/web/src/tags/tags-api.ts always requests bare /tags, and apps/web/src/tickets/inbox-page.tsx:58 renders <TagSidebar /> without the status it computes at line 24.

### Open questions for you

The plan proceeds on the assumption shown; answer only where you disagree.

- **Contract shape: hybrid (optional ticketCount on Tag, required on new TagWithCount for GET /tags, inline allOf member with properties.ticketCount), vs required on Tag everywhere, vs TagWithCount with Tag unchanged?**  
  Assumed: Hybrid, using the step 1 YAML that generates `Tag & { ticketCount: number }`. The cost is that Tag's type advertises an optional ticketCount on endpoints that never send it.
- **Should the sidebar counts refresh after 'Simulate incoming email' delivers mail?**  
  Assumed: Yes. onDelivered also bumps a `refresh` prop on TagSidebar that is part of its useApi key. Tagging on the detail page is covered because returning to the inbox remounts it.
- **Should the count ignore the active tag filter?**  
  Assumed: Yes. Counts follow the inbox status only (criterion 2).
- **Should the count be styled apart from the tag name (muted or right-aligned)?**  
  Assumed: No. The name and count render as one plain text run, 'billing 4', so the exact text and the accessible name both match the spec's example. There is no .tag-count span or CSS.

### Risks

- Contract shape vs held-out typecheck. npm run typecheck includes acceptance/tsconfig.json. A required ticketCount on Tag breaks Tag-typed literals that lack it (e.g. makeTicket({ tags: [billing] }) in web tests and likely held-out tests) and pushes counts into Ticket.tags and the mutation responses. A separate schema with Tag unchanged breaks held-out code that reads .ticketCount off a Tag. Recommended hybrid: optional ticketCount on Tag, plus a TagWithCount (allOf Tag, ticketCount required) for GET /tags.
- Zero-count SQL trap: LEFT JOIN plus WHERE t.status = ? drops tags with no matching tickets (criterion 3). Use a correlated subquery or put the filter in the ON clause.
- apps/web/test/mock-api.ts matches query strings exactly. Changing the sidebar URL to /tags?status=open makes the existing GET /tags mocks 404, the sidebar renders empty, and inbox-page 'filters by tag' fails. Keep listTags() for TagPicker so tag-picker and ticket-detail-page mocks still match.
- Putting the count inside the link changes its accessible name to 'billing N'. Exact-name link queries must change. Do not change the href logic at tag-sidebar.tsx:18-23 (criterion 7).
- The sidebar useApi key must include the status, or switching Open/Closed/All will not refetch counts.
- Do not add any caching of counts. Rules (legacy/rules/context.js:123) and the per-ticket tag endpoints write ticket_tags directly, and the spec requires immediate freshness.
- Regenerate schema.d.ts with npm run generate and keep it in the change. scripts/check.ts diffs it against openapi.yaml.
- Out of scope but noted: setTicketStatus (tickets-repository.ts:108-116) writes status/closed_at without clearing the mailroom SLA cache, contrary to CLAUDE.md.

## FD-02: Latin-1 subjects are garbled

**Kind:** bug · **Size:** S · **Plan:** [`tmp/plans/FD-02.md`](plans/FD-02.md) · **Spec:** [`specs/FD-02.md`](../specs/FD-02.md)

**Plan review:** 1 junior-engineer round(s), ready with 0 blocking questions (8 non-blocking notes left in the plan) · **Failing test:** verified on attempt 1 of 1

In raw .eml mail, RFC 2047 encoded words labelled ISO-8859-1 are always decoded as UTF-8, because the vendored mailparse-lite reads the charset label and then ignores it. Every Latin-1 accented byte in the Subject and the From display name therefore becomes U+FFFD. The fix is legacy-only: in legacy/ingest/parse.js, transcode ISO-8859-1 encoded words in the header block to UTF-8 before calling mailparse.parse, as PATCHES.md prefers. The alternative is a vendored patch 3. A legacy ingest test using fixtures/mail/poster-reprint-quote.eml proves the bug.

### Root cause

vendor/mailparse-lite/index.js:8 captures the charset as group 1 of ENCODED_WORD. decodeWords (index.js:50-52) ignores that value and decodes every word with bytes.toString('utf8'). On their own, Latin-1 0xE9 (é) and 0xC9 (É) are not valid UTF-8, so each becomes U+FFFD. The subject (index.js:121) and the From display name (parseAddress, index.js:56-58) both pass through decodeWords. legacy/ingest/parse.js:54-66 copies the results straight into tickets.subject (ingest.js:81), messages.from_name (ingest.js:102) and customers.name (models/customer.js:35). Folding and mixed plain text already work: index.js:18 unfolds continuation lines, and patch 1 at index.js:49 joins adjacent words. Only the charset is ignored. Reproduced on main: the poster-reprint-quote fixture gives "Devis pour une r�impression d'affiches" from "Ren�e Dub�", and inbox/0039 (seeded ticket #36) gives "�preuves des cartes de visite : d�lai de livraison?".

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-20` on branch `worktree-wf_b6af7eba-389-20` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-20/legacy/test/ingest.test.js`](../.claude/worktrees/wf_b6af7eba-389-20/legacy/test/ingest.test.js)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project legacy test/ingest.test.js -t "ISO-8859-1"
  ```

- **Observed on main:** 2 failed | 11 skipped — `expected 'Devis pour une r\ufffdimpression…' to be 'Devis pour une réimpression…'`
- **Why that is the right failure:** AssertionError: expected 'Devis pour une r�impression d'affiches' to be 'Devis pour une réimpression d'affiches' (case 2: expected 'Re: �preuves et d�lai ok' to be 'Re: Épreuves et délai ok'). Both values were confirmed by running the parser on main. These are the right failures because they show the spec's symptom directly: decodeWords decodes Latin-1 bytes as UTF-8 and silently produces replacement characters, with no import or syntax error.
- **Verifier notes (not blocking):**
  - Minor, not blocking: test 2's fold is a plain-text continuation (' ok' with two leading spaces), and the expected 'délai ok' has one space. That relies on the current unfold regex at vendor/mailparse-lite/index.js:18, which collapses CRLF plus all following whitespace into one space. A fix that also switched to strict RFC 5322 unfolding would get two spaces and fail. AC3 says existing behaviour must stay the same, so a correct fix is unlikely to touch that. A single-space fold continuation would remove the dependency. The folded encoded word itself is covered by test 1's fixture.
  - Cosmetic: test 2 never calls pollOnce, but it sits inside the 'pollOnce' describe block.

### Where the fix goes

- [`vendor/mailparse-lite/index.js:52`](../vendor/mailparse-lite/index.js) — Tier: execution path (traced). The decodeWords replacer receives `charset` but always returns bytes.toString('utf8'), so the Latin-1 bytes 0xE9 and 0xC9 become U+FFFD. This produces exactly the received strings.
- [`vendor/mailparse-lite/index.js:8`](../vendor/mailparse-lite/index.js) — Tier: execution path. The ENCODED_WORD regex captures the charset label as group 1, so the information is there but nothing uses it.
- [`legacy/ingest/parse.js:55`](../legacy/ingest/parse.js) — Tier: execution path. fromEml passes the raw buffer straight to mailparse.parse and copies subject and from.name unchanged. This is the mailroom-side spot where PATCHES.md says input fixes should go first.
- [`vendor/mailparse-lite/index.js:121`](../vendor/mailparse-lite/index.js) — Tier: execution path. The subject is sent through decodeWords (case 1 and case 2 subject failures).
- [`vendor/mailparse-lite/index.js:57`](../vendor/mailparse-lite/index.js) — Tier: execution path. parseAddress sends the From header through decodeWords, which garbles from.name, messages.from_name and customers.name.

### Risks

- Rewrite only the header block (before the first blank line). Transcoding inside the body would change quoted text, and bodies are out of scope.
- Re-emit Latin-1 words as =?UTF-8?B?...?= encoded words rather than decoding them inline, so patch 1 still drops the whitespace between adjacent encoded words.
- Raw unencoded 8-bit Latin-1 header bytes stay garbled, because index.js:115 decodes the buffer as UTF-8. This is out of scope.
- Charset aliases (latin1, ISO8859-1, windows-1252, RFC 2231 '*lang' suffixes) won't match a strict case-insensitive iso-8859-1 compare. The spec limits scope to ISO-8859-1.
- Existing databases are not healed. Garbled tickets.subject and messages.from_name stay, and customers.name is first-write-wins, so it never self-corrects. AC4 relies on npm run reset.
- Patching vendor/mailparse-lite instead requires a 'front-desk patch 3' comment and a PATCHES.md entry, and it goes against PATCHES.md's guidance.
- No status/created_at/closed_at write happens, so the state mirror (#142) and the sla:<id> cache are untouched. Nothing in apps/api changes, so the adapter boundary is not involved.
- npm run check/smoke may show the known flaky legacy/test/rules/assign-round-robin.test.js (FD-03). It is unrelated to this change.

## FD-03: CI is red, laptops are green

**Kind:** test-infrastructure · **Size:** S · ★ core · **Plan:** [`tmp/plans/FD-03.md`](plans/FD-03.md) · **Spec:** [`specs/FD-03.md`](../specs/FD-03.md)

**Plan review:** 2 junior-engineer round(s), ready with 0 blocking questions (12 non-blocking notes left in the plan) · **Failing test:** verified on attempt 3 of 3

CI fails because legacy/test/rules/assign-round-robin.test.js depends on test order. The rule keeps its rotation counter at module scope, and all six tests share one loaded copy. CI shuffles tests within each file, while laptops run them in declaration order. Following the approved tmp/PLAN.md, the fix changes test code only: reload the rule before each test, have the two tests that relied on earlier tests set up their own history, and remove the entry from KNOWN_FAILURES.md. Production rules and rules:parity stay unchanged.

### Root cause

legacy/rules/assign-round-robin.js:8 declares `let next = 0` at module scope, and :26-27 pick ctx.teammates[next % n] and then increment it. The test file loads the rule once with createRequire (test :6-7), so all six tests share one counter. Three tests hard-code a teammate that is only right if earlier tests already moved the counter: :25 expects 1 (counter 0), :31 expects 2 (counter 1), :44-47 expect 3 then 1 (counter 2). CI sets a random TEST_SEED (.github/workflows/ci.yml:30), and scripts/test-order.ts:49 turns it into --sequence.shuffle --sequence.seed, which also shuffles tests inside the file, so the counter is usually wrong when a test starts. npm test and npm run check without a seed run in declaration order (scripts/check.ts:58, shuffleByDefault false) and pass. vitest.config.ts:26-34 keeps per-file isolation, so nothing leaks between files. Seed 98848 fails 'gives the first ticket', which confirms the shuffle inside this file is the cause. Production is meant to carry the counter between calls in one process, and the golden fixtures and rules:parity depend on that, so the rule stays as it is and only the test changes.

### Failing test

- **Where:** no new file. The existing test is the failing test, run with a shuffle seed. The reenactor changed nothing, so its worktree was removed automatically.
- **Test:** [`legacy/test/rules/assign-round-robin.test.js`](../legacy/test/rules/assign-round-robin.test.js)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC node node_modules/vitest/vitest.mjs run --project legacy legacy/test/rules/assign-round-robin.test.js --sequence.shuffle --sequence.seed=2
  ```

- **Observed on main:** 2 failed | 4 passed — `expected [ { type: 'assign', teammateId: 3 } ] to deeply equal [ { …teammateId: 2 } ]`
- **Why that is the right failure:** On main, observed in Round 1: exit 1 with `2 failed | 4 passed (6)`. 'gives the next ticket to the next teammate' fails with `expected [ { type: 'assign', teammateId: 3 } ] to deeply equal [ { type: 'assign', teammateId: 2 } ]`, and 'wraps around after the last teammate' fails on its two-item sequence (it expects [3, 1]). That is the right reason. Both tests assert a fixed teammate, but every test in the file shares the one module-level counter (`let next = 0` at legacy/rules/assign-round-robin.js:8, loaded once at legacy/test/rules/assign-round-robin.test.js:6-7), and in seed 2's order other tests have already moved it. The failures are assertion errors, not load or setup errors. After the fix, the same command exits 0 with `6 passed (6)`.

### Where the fix goes

- [`legacy/test/rules/assign-round-robin.test.js:31`](../legacy/test/rules/assign-round-robin.test.js) — Tier 1, from a stack frame: asserts teammate 2, which is only correct if exactly one assignment has already run in this process. It got 3 under seed 2.
- [`legacy/test/rules/assign-round-robin.test.js:44`](../legacy/test/rules/assign-round-robin.test.js) — Tier 1, from a stack frame: asserts [3, 1], which assumes the counter is 2 on entry. It got [1, 2] under seed 2.
- [`legacy/test/rules/assign-round-robin.test.js:7`](../legacy/test/rules/assign-round-robin.test.js) — Tier 2, on the execution path: `const rule = require('../../rules/assign-round-robin')` loads the rule once through createRequire (line 6), so all six tests share one module instance and its counter.
- [`legacy/rules/assign-round-robin.js:8`](../legacy/rules/assign-round-robin.js) — Tier 2, on the execution path: `let next = 0;` holds the rotation at module scope. Lines 26-27 read `teammates[next % length]` and then `next += 1`, so state carries over between tests. The plan says this production behaviour is intended and must stay.
- [`scripts/test-order.ts:49`](../scripts/test-order.ts) — Tier 3, the environment difference: a seed becomes `--sequence.shuffle --sequence.seed=<n>`. CI picks a random seed at .github/workflows/ci.yml:30, while scripts/check.ts:58 uses `shuffleByDefault: false` locally. That explains CI red, laptops green.

### Open questions for you

The plan proceeds on the assumption shown; answer only where you disagree.

- **Who runs `npm run feature:check -- FD-03`, and who commits, pushes branch fd-03-round-robin-order and opens the PR? tmp/PLAN.md:3,196 records your approval of T11, but the first draft of the FD-03 plan left this open.**  
  Assumed: The implementer works in a new git worktree and runs D0-D13 there, including feature:check, which writes only the worktree's features.json. The implementer then stops and asks in chat before D14 (commit, push, PR). If you confirm that your earlier approval covers D14, the pause goes away. You merge the PR, and D14.3 (the push run on main) is checked after that.
- **Where should the worktree live?**  
  Assumed: At /Users/stevekinney/Developer/front-desk-fd-03, on local branch fd-03-round-robin-order, created from main. If that branch or directory already exists, the implementer stops and asks instead of reusing or deleting it.
- **Should FD-03 be tracked as test-infrastructure or as a bug?**  
  Assumed: test-infrastructure, because production code in legacy/rules/ is deliberately left unchanged (tmp/PLAN.md C2 and C3).

### Risks

- delete require.cache[rulePath] resets only the rule module. It works today because assign-round-robin.js has no requires of its own. If FD-08 or anything else gives the rule a dependency that holds state, that dependency would need evicting too.
- The reset relies on Node's CommonJS cache through createRequire. Switching the test to ESM import would silently break it, so keep createRequire.
- Per-file isolation is load-bearing. Setting isolate:false or a shared pool in vitest.config.ts would make the reload also reset the copies golden.test.js and apply-to.test.js see.
- Do not 'fix' this by editing legacy/rules/ (a reset hook, a counter on ctx, a derived counter). That breaks rules:parity golden cases 2, 3, 6, 7, 8 and 10 and the approved C2/C3.
- tmp/ is not in .prettierignore, so tmp/PLAN.md and tmp/plans/FD-03.md must stay Prettier-clean or npm run check fails at format.
- PLAN.md T3 and T4 temporarily edit tracked files (T4 edits legacy/rules/ and reverts it), T9 writes features.json, and T11 commits, pushes and opens a PR. They must run in a worktree or be done by the user, not in the main checkout by an agent.
- The traps named in the brief are not touched: the status/state mirror and nightly-csv (#142), the SLA cache, config read at require time, the legacy-adapter boundary, and the mailroom lock (#97). The rule only calls ctx.assign.

## FD-04: Pending-customer pauses the SLA clock

**Kind:** missing-feature · **Size:** M · ★ core · **Plan:** [`tmp/plans/FD-04.md`](plans/FD-04.md) · **Spec:** [`specs/FD-04.md`](../specs/FD-04.md)

**Plan review:** 2 junior-engineer round(s), ready with 0 blocking questions (16 non-blocking notes left in the plan) · **Failing test:** verified on attempt 1 of 1

Nothing records when a ticket went pending, so pending tickets keep counting down and turn breached. The SLA comes only from created_at, status and closed_at, and there is no paused state in the mailroom, the contract or the web badge. Separately, the API changes status with raw SQL on its own connection. That skips Ticket.afterSave, the only thing that clears the mailroom's per-ticket SLA cache, so after any read a status change doesn't show in the SLA. Both mechanisms were reproduced on main.

### Root cause

Missing feature: - legacy/lib/sla.js snapshot() computes dueAt = addBusinessMinutes(created_at, 480) with no pause data. - summarize() treats pending like open, so it counts down and goes breached. - tickets has no columns or table for pause start or accumulated paused business minutes. - Ticket.updateStatus does no pause bookkeeping. - The OpenAPI Sla.state enum, the adapter's LegacySlaSummary union and the web slaLabel have no 'paused' (slaLabel's default branch prints 'Due in...'). Criterion 5 bug: - apps/api tickets-repository setTicketStatus runs UPDATE tickets on the API's own DatabaseSync connection. It keeps the status/state mirror but bypasses the Ticket model, so Ticket.afterSave never runs cache.del('sla:'+id). - sla.forTicket returns the cached snapshot, which holds status and closedAt and never expires. After any GET, the PATCH response and later reads show the pre-change SLA until something re-saves the ticket through the model. Fix: make Ticket.updateStatus the single status writer. It starts a pause on ->pending and banks businessMinutesBetween on pending->open/closed into new paused_at/paused_minutes columns, added through a PRAGMA-guarded migration and a beforeSave default. The API calls it through a new promisified adapter wrapper. snapshot/summarize extend the due time by the banked minutes and return state 'paused' with frozen remainingMinutes. Pre-existing, belongs to FD-07: isBusinessHour uses <= closeHour, so 17:00-18:00 NY counts as business time.

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-59` on branch `worktree-wf_b6af7eba-389-59` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-59/apps/api/src/tickets/tickets.test.ts`](../.claude/worktrees/wf_b6af7eba-389-59/apps/api/src/tickets/tickets.test.ts)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project api src/tickets/tickets.test.ts -t "pauses the SLA"
  ```

- **Observed on main:** 1 failed | 17 skipped — `expected 'on-track' to be 'paused'`
- **Why that is the right failure:** On main: AssertionError: expected 'on-track' to be 'paused'. This is the right failure because the SLA has no paused state and pending keeps counting down (legacy/lib/sla.js:150-174). The warmed cache also means the raw-SQL status write (tickets-repository.ts:108-116) is invisible, so the fix must handle both. A fresh ticket has about 480 business minutes left, well above the 120-minute at-risk threshold, so the failure doesn't depend on the time of day or on the 17:00 decision.
- **Verifier notes (not blocking):**
  - Not blocking: the diff adds a second new failing test that the given command doesn't select: 'shows a close in the SLA even after the ticket was read' (apps/api/src/tickets/tickets.test.ts:118-128). It legitimately tests FD-04 criterion 5, the stale sla:<id> cache after setTicketStatus's raw-SQL write. It fails for the right reason (got on-track/479 instead of met/null) and a correct fix would make it pass. The orchestrator should still know the full api project shows 2 new failures, not 1. Either widen the command's -t filter to cover both tests or document the second one as part of this FD-04 failing set.

### Where the fix goes

- [`legacy/lib/sla.js:150`](../legacy/lib/sla.js) — On the traced path: summarize() has no 'paused' branch, so a pending ticket falls through to the countdown (lines 150-174) and reports 'on-track'. This is test 1's failure.
- [`apps/api/src/tickets/tickets-repository.ts:108`](../apps/api/src/tickets/tickets-repository.ts) — On the traced path: setTicketStatus (lines 108-116) changes the status with raw SQL on the API's own connection, bypassing the Ticket model. So Ticket.afterSave, the only thing that runs cache.del('sla:'+id), never runs. This is test 2's failure.
- [`legacy/lib/sla.js:182`](../legacy/lib/sla.js) — On the traced path: forTicket (lines 182-194) returns the cached snapshot, which never expires and still holds the old status and closedAt. This is why the PATCH response shows the earlier SLA.
- [`legacy/lib/sla.js:135`](../legacy/lib/sla.js) — On the traced path: snapshot() (lines 135-143) sets the due time to created_at plus 480 business minutes, with no paused time added.
- [`legacy/models/ticket.js:61`](../legacy/models/ticket.js) — On the traced path: Ticket.updateStatus (lines 61-76) does no pause bookkeeping (no paused_at or paused_minutes). afterSave at lines 44-49 is where the cache gets cleared.

### Open questions for you

The plan proceeds on the assumption shown; answer only where you disagree.

- **While a ticket is paused, what should dueAt show?**  
  Assumed: The projected due time if it resumed now: addBusinessMinutes(dueBanked, businessMinutesBetween(pausedAt, now)). remainingMinutes stays frozen from dueBanked.
- **Should FD-04 fix the 17:00-hour bug (legacy/lib/sla.js:55, <= to <) or leave it to FD-07?**  
  Assumed: Fix it in FD-04 (step 3a). The criterion-3 tests assert 120 for Fri 16:00->Mon 10:00 NY, and due times shift later for tickets arriving after 09:00.
- **Should the sla_report view / finance export subtract paused time?**  
  Assumed: No. It is unchanged because of issue #142.
- **Is the cross-process cache gap (cron auto-close of pending tickets shows 'Paused, overdue' in the API until restart) in scope for FD-04?**  
  Assumed: Follow-up. FD-04 covers API-originated status changes through the single writer.
- **Should a ticket that was already overdue when it went pending show 'Paused' with the overdue amount?**  
  Assumed: Yes: state 'paused', negative remainingMinutes kept, label 'Paused, overdue ...'.
- **Is it fine that the demo seed's pending tickets mostly show 'Paused, overdue ...' (paused_at = lastActivity, 24 wall hours after arrival)?**  
  Assumed: Yes. Keep paused_at = lastActivity.

### Risks

- Issue #142: every status write must keep tickets.state in step; routing through Ticket.updateStatus keeps beforeSave's mirror. Leave nightly-csv.js and the sla_report view alone.
- Migration idempotency: SQLite has no ADD COLUMN IF NOT EXISTS, so a bare ALTER in schema.sql breaks the second startup. Guard it in migrate() with PRAGMA table_info, backfill paused_at for already-pending tickets, and add a run-twice test (test databases are always fresh).
- paused_minutes NOT NULL DEFAULT 0 needs a beforeSave default, because the model inserts explicit NULLs for unset columns; otherwise every ticket insert fails.
- Circular require: sla.js already requires models/ticket, so ticket.js must require sla lazily, as connection.js:45 does.
- Cross-process cache staleness: cron's sweep-rules auto-closes pending tickets in another process, and the API's cache never expires. Unit tests can't see this; consider checking updated_at in forTicket.
- 17:00-hour bug at sla.js:55 (FD-07) makes evening pauses add 60 minutes; write FD-04 tests that avoid 17:00-18:00 NY, or decide to fix it here.
- Rounding: businessMinutesBetween floors per interval, so banking per pause can drift by a minute when pauses start or end off a minute boundary.
- Time source: API now() uses the real Date while the SLA uses legacy clock.js; the single writer puts paused_at, closed_at and updated_at on the legacy clock.
- FD-10 (table rebuild) must carry the new columns; FD-08 (rules to TS) must keep the single status writer; FD-07 must keep banked minutes valid.
- The web inbox defaults to ?status=open, so a paused badge appears only under the pending filter.

## FD-05: Create a ticket from the web

**Kind:** missing-feature · **Size:** M · ★ core · **Plan:** [`tmp/plans/FD-05.md`](plans/FD-05.md) · **Spec:** [`specs/FD-05.md`](../specs/FD-05.md)

**Plan review:** 1 junior-engineer round(s), ready with 0 blocking questions (15 non-blocking notes left in the plan) · **Failing test:** verified on attempt 1 of 1

There is no way to create a ticket from the web, and no layer supports it: the contract has no POST /tickets, the API has no route, the mailroom can only create tickets from inbox mail, and the inbox page has no "New ticket" control. On main, POST /api/tickets falls through to unknownRoute and returns 404 {"error":"No such route"} without creating anything (reproduced against a throwaway DB). The fix is a vertical slice: contract, then a new mailroom openTicket function exposed through legacy-adapter.ts, then the API route and zod schema, then the web form and route. Creating the ticket through the Ticket model keeps state mirrored and the SLA cache cleared, and skipping the automation rules keeps the ticket unassigned.

### Root cause

Absent at every layer. (1) The `/tickets` path in packages/contract/openapi.yaml has only `get: listTickets` and no create operation or input schema, so schema.d.ts has neither. (2) apps/api/src/tickets/tickets-router.ts has no `router.post('/tickets')`, and tickets-schemas.ts has no create schema. The request reaches unknownRoute in http.ts:39-41, which returns 404. (3) In the mailroom, the only ticket-creation path is ingest.js `ingestNew`. It is tied to parsed mail and threading, and its `afterIngest` runs the automation rules. With rules on in production, assign-round-robin would assign the ticket and break "unassigned". legacy/index.js exports no create entry point, and the LegacyMailroom interface in legacy-adapter.ts has no wrapper for one. (4) Web: the inbox-page.tsx header holds only SimulateMailButton, tickets-api.ts has no createTicket, app.tsx has no new-ticket route, and test/mock-api.ts can only answer 200, so AC5 can't be tested in the web project until it can return other statuses. The work belongs in: openapi.yaml plus regenerated schema.d.ts; a new legacy/tickets/open-ticket.js that calls Customer.findOrCreate, then Ticket.create, then Message.create, with no rules, exported from legacy/index.js; an openTicket wrapper in legacy-adapter.ts; POST /tickets in tickets-router.ts with a zod schema, returning 201 with a TicketDetail; and a new-ticket form, a route and a createTicket client in the web app.

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-27` on branch `worktree-wf_b6af7eba-389-27` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-27/apps/api/src/tickets/tickets.test.ts`](../.claude/worktrees/wf_b6af7eba-389-27/apps/api/src/tickets/tickets.test.ts)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project api apps/api/src/tickets/tickets.test.ts -t "creates an open, unassigned ticket"
  ```

- **Observed on main:** 1 failed | 16 skipped — `expected 201 "Created", got 404 "Not Found"`
- **Why that is the right failure:** supertest's .expect(201) throws `expected 201 "Created", got 404 "Not Found"`. No POST /tickets route exists, so the request falls through to unknownRoute (apps/api/src/http.ts:39-41) and returns {"error":"No such route"}; I reproduced this on main with a throwaway DB. That is the spec's gap: there is no way to create a ticket from the web. It is an assertion failure, not an import or syntax error.

### Where the fix goes

- [`apps/api/src/tickets/tickets-router.ts:35`](../apps/api/src/tickets/tickets-router.ts) — On the request path: the router has GET /tickets (line 35) but no router.post('/tickets'), so a POST /api/tickets matches nothing here. The handler belongs next to it, and it should return 201 with { ...loadTicket(id), messages: listMessages(db, id) } like lines 41-46.
- [`apps/api/src/http.ts:39`](../apps/api/src/http.ts) — On the request path: this is where the observed 404 {"error":"No such route"} comes from. It is a symptom, not the thing to fix; app.ts:24 registers it after every router.
- [`apps/api/src/tickets/tickets-schemas.ts:1`](../apps/api/src/tickets/tickets-schemas.ts) — On the request path: there is no create-ticket zod schema to validate customerEmail, customerName, subject and body. AC5 needs all validation to happen here, before any write.
- [`apps/api/src/legacy-adapter.ts:26`](../apps/api/src/legacy-adapter.ts) — Needed by the fix: the LegacyMailroom interface (lines 26-46) has no create-ticket member and no promisified wrapper, and this is the only file allowed to import legacy/.
- [`legacy/index.js:24`](../legacy/index.js) — Needed by the fix: there is no create-ticket export. The only way tickets get created today is ingestNew (legacy/ingest/ingest.js:71-121), and its afterIngest runs the automation rules, which would break 'unassigned' in production.

### Risks

- Don't create the ticket by writing an inbox file and polling, or by reusing ingest/afterIngest. Either path runs the automation rules in production, and assign-round-robin or escalate-vip would assign the ticket, violating AC3. API tests run with MAILROOM_RULES=off, so they wouldn't catch it.
- Don't insert the rows with raw SQL from the API. That skips Ticket.beforeSave/afterSave (state mirror, created_at from the mailroom clock, SLA cache clear) and breaks the rule that only the mailroom creates tickets and only legacy-adapter.ts touches legacy/.
- AC5 requires that a 400 creates nothing. All validation, including trimming blank subject and message, must finish in zod before the adapter is called, because the mailroom's customer, ticket and message writes are not transactional.
- Return TicketDetail, which includes messages, not bare Ticket. It matches GET /api/tickets/{id} under either reading of AC2.
- Case-insensitive customer matching relies on emails being stored in lowercase, which every path that exists today guarantees through Customer.findOrCreate. An exact-match findOne would miss a mixed-case row inserted some other way.
- Run npm run generate and commit schema.d.ts. The contract-drift step in npm run check fails otherwise.
- The web form must not let native HTML required/type=email validation block submission in tests that expect the API's 400 to be shown (use noValidate). Add the tickets/new route so TicketDetailPage never parses 'new' as an id.
- Extending apps/web/test/mock-api.ts to return non-200 statuses touches every web test, so keep it backward compatible.
- In the new legacy test, clock.freeze is module-level state. Reset it in afterEach, because CI shuffles the test order.
- Interactions: FD-10 will drop state, so keep the mirror inside Ticket.beforeSave. FD-08 and FD-09 apply to incoming mail, so keep web-created tickets out of those paths.

## FD-06: Ticket priority end to end

**Kind:** missing-feature · **Size:** M · **Plan:** [`tmp/plans/FD-06.md`](plans/FD-06.md) · **Spec:** [`specs/FD-06.md`](../specs/FD-06.md)

**Plan review:** 2 junior-engineer round(s), ready with 0 blocking questions (8 non-blocking notes left in the plan) · **Failing test:** verified on attempt 1 of 1

Ticket priority does not exist in any layer: there is no tickets.priority column or migration, no contract field, parameter or operation, no API endpoint or filter, no web label or select, and no column in the finance export. Building it means guarding a non-idempotent ALTER TABLE in the mailroom's migrate(), giving the Ticket model a 'normal' default so ingest doesn't insert an explicit NULL, and appending priority as the last export column without changing anything before it. A failing API test and a failing export test were both confirmed in a scratch copy of main.

### Root cause

Absent everywhere. legacy/db/schema.sql has no priority column on tickets, and legacy/db/connection.js migrate() only execs schema.sql, which runs on every startup. A bare ALTER ADD COLUMN fails on the second run with 'duplicate column name', so the change needs a pragma_table_info-guarded ALTER in migrate() after exec. The Ticket model (legacy/models/ticket.js) lists its columns explicitly, and lib/model.js sets any missing attribute to null and inserts every listed column. If 'priority' is added to the columns, beforeSave has to default it to 'normal' or ingest fails with NOT NULL (reproduced). The contract (openapi.yaml) lacks a TicketPriority schema, Ticket.priority, the listTickets priority parameter and the PATCH /tickets/{id}/priority operation; contract/src/index.ts lacks TicketPriority and TICKET_PRIORITIES. In the API, tickets-repository.ts SELECT_TICKETS, TicketRow, toRecord and listTicketRecords, the tickets-schemas.ts zod schemas and the tickets-router.ts handler all need it. In the web app, inbox-page.tsx needs a High/Urgent label, ticket-detail-page.tsx a Priority select, tickets-api.ts an updatePriority, and test/mock-api.ts makeTicket a default. legacy/export/nightly-csv.js needs priority appended to COLUMNS, the SELECT and the row. The export runs from ops/crontab and never calls migrate(), which is the same failure mode as issue #142. The SLA cache and the status/state mirror are not affected: priority isn't in the sla.js snapshot and the priority update doesn't touch status.

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-49` on branch `worktree-wf_b6af7eba-389-49` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-49/apps/api/src/tickets/tickets.test.ts`](../.claude/worktrees/wf_b6af7eba-389-49/apps/api/src/tickets/tickets.test.ts)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project api src/tickets/tickets.test.ts -t "ticket priority"
  ```

- **Observed on main:** 1 failed | 16 skipped — `expected undefined to be 'normal'`
- **Why that is the right failure:** On main the first expect fails with `AssertionError: expected undefined to be 'normal'` (confirmed in a scratch copy). This is the right reason: GET /api/tickets/:id returns no priority field because tickets.priority, the contract field and the repository mapping do not exist yet (criteria 1 and 2). It is not a typecheck failure or a missing route, which would only show up after that assertion.

### Where the fix goes

- [`apps/api/src/tickets/tickets-repository.ts:27`](../apps/api/src/tickets/tickets-repository.ts) — SELECT_TICKETS builds the GET /api/tickets/:id response (used at :88) and does not select t.priority, so before.body.priority is undefined. Tier: on the traced path that produced the observed value.
- [`apps/api/src/tickets/tickets-repository.ts:37`](../apps/api/src/tickets/tickets-repository.ts) — toRecord (and TicketRow at :10) does not map priority, and listTicketRecords (:60) has no priority filter for criterion 4. Tier: execution path.
- [`legacy/db/schema.sql:18`](../legacy/db/schema.sql) — CREATE TABLE tickets has no priority column, so there is nothing to select and no DEFAULT 'normal' for tickets created by email. Tier: execution path (ingest writes this table).
- [`legacy/db/connection.js:114`](../legacy/db/connection.js) — migrate() only execs schema.sql, so existing databases would never get the column. A guarded (pragma_table_info) ALTER is needed because a bare ALTER fails on the second startup. Tier: execution path (called via migrateLegacy in apps/api/test/helpers.ts).
- [`packages/contract/openapi.yaml:441`](../packages/contract/openapi.yaml) — The Ticket schema has no priority field, there is no TicketPriority schema near TicketStatus (:378), the listTickets operation (:31) has no priority parameter, and there is no /tickets/{ticketId}/priority operation alongside /status (:74). That is why toRecord typechecks without the field. Tier: imports of the path (generated types).

### Open questions for you

The plan proceeds on the assumption shown; answer only where you disagree.

- **1a. Is it acceptable for the 02:15 nightly export to run the idempotent migration (a guarded ALTER TABLE) against the production DB itself, rather than relying on a deploy step such as 'restart the API before 02:15'?**  
  Assumed: Yes. exportDay calls db.migrate first. This matches the repo convention that every schema statement is safe to run twice (CLAUDE.md, Database), and it removes the #142 failure mode without depending on deploy order.
- **1b. Should legacy/bin/sweep-rules.js also migrate on start, so future columns are safe there too?**  
  Assumed: No, not in FD-06. With priority out of Ticket.columns, the sweep never reads or writes priority and already runs on either DB shape.
- **2. Should PATCH /priority bump updated_at (moving the ticket up the inbox)?**  
  Assumed: Yes, as assignTicket does (tickets-repository.ts:118-124).
- **3. For an invalid priority body on a missing ticket, 400 or 404?**  
  Assumed: 400. The body is validated before the existence check, as /status does (tickets-router.ts:48-54).
- **4. Should the web inbox get a priority filter (sidebar or URL ?priority=)?**  
  Assumed: No. Spec criterion 4 asks only for the API parameter, so tickets-api.ts TicketFilters/listTickets and inbox-page.tsx are not changed for filtering.
- **5. What should the ticket-page Priority select do when PATCH /priority fails?**  
  Assumed: Same as Assignee (ticket-detail-page.tsx:63-70). The select is controlled by ticket.priority and updated from the response, with no error handling. On failure it keeps showing the old value.
- **6. Has finance been told about the new export column (#142 asked for format changes in writing)?**  
  Assumed: This gates the deploy, not the merge or the definition of done.
- **7. Do you want demo priorities in the seed data?**  
  Assumed: No, because criterion 2 says every existing ticket is normal.

### Risks

- Placing ALTER TABLE in schema.sql (or either .sql file) breaks the second startup with 'duplicate column name'. Guard it with pragma_table_info in legacy/db/connection.js migrate() after exec(schema.sql), and keep any priority index out of schema.sql because it would run before the ALTER on old DBs.
- Adding 'priority' to Ticket.columns without a beforeSave default makes every email ingest fail with NOT NULL constraint failed (model.js:41 nulls missing attrs).
- nightly-csv.js and sweep-rules.js run from cron and never migrate. If the new export code runs before the API has restarted and migrated the live DB, the 02:15 export fails with 'no such column: t.priority' and finance gets no file (a repeat of #142). Either migrate in the export or make an API restart before the next cron run a deploy step.
- Every existing export column must keep its name, position, values, CRLF endings and quoting; only append priority last. Finance asked for format changes in writing (#142).
- npm run typecheck includes the held-out acceptance/tsconfig.json. Mirror existing naming exactly (TicketPriority, TICKET_PRIORITIES, operationId updateTicketPriority, updatePriority in tickets-api.ts); a mismatch shows up only as a typecheck failure that can't be previewed.
- Making priority required on Ticket breaks the typecheck of tickets-repository.ts toRecord and apps/web/test/mock-api.ts makeTicket until both include it. Regenerate and commit schema.d.ts, or the drift check fails.
- The 'urgent' tag (seed, escalate-vip) and the 'Urgent' priority label are different things. Don't make rules set priority, and match 'Urgent' exactly (case-sensitive) in web tests.
- Don't clear the SLA cache or write state for priority updates; neither is involved. Never use closeLegacy().
- FD-10 removes state. The export's state column values must survive, and priority must stay the last column whichever item lands first.
- The legacy export test needs FINANCE_EXPORT_DIR set in legacy/test/setup.js, because helpers.js loads config at import time. Without it, the test writes into the repo's exports/ directory.
- Don't seed demo priorities: criterion 2 says every existing and emailed ticket is normal, and inbox/0041 contains injected text asking for high priority.

## FD-07: Business-hours settings drive the SLA

**Kind:** missing-feature · **Size:** M · **Plan:** [`tmp/plans/FD-07.md`](plans/FD-07.md) · **Spec:** [`specs/FD-07.md`](../specs/FD-07.md)

**Plan review:** 2 junior-engineer round(s), ready with 0 blocking questions (12 non-blocking notes left in the plan) · **Failing test:** verified on attempt 1 of 1

The desk's business hours, time zone and SLA length exist only as constants in legacy/config.js. Nothing stores them, there is no HTTP surface, contract, SLA report endpoint or web page for them, and the SLA code captures the time zone and caches each ticket's due time, so runtime changes would never reach tickets that were already read. Criterion 4 also exposes two bugs in the current math, both reproduced: the 17:00 hour counts as business time (540 minutes per day instead of 480), and the code steps in whole UTC hours, so half-hour zones such as Asia/Kolkata miscount (450 instead of 480).

### Root cause

Missing feature: the SLA settings are a literal `sla` object in legacy/config.js:51-57, read once at require time. No table stores them, app.ts mounts no settings or reports router, openapi.yaml has no /settings or /reports paths, legacy-adapter.ts exposes only sla.forTicket, and the web header has no Settings link. Even with a store, four links stop runtime changes from taking effect. (1) legacy/lib/sla.js:20-25 builds the time-zone formatter at module load. (2) sla.js:55 and sla.js:136 read config.sla directly. (3) sla.js:182-194 caches the snapshot, including the computed dueAt, under sla:<id>, and only Ticket.afterSave evicts it (legacy/models/ticket.js:44-49). (4) businessMinutesBetween is synchronous and runs inside the SQLite user function business_minutes() (legacy/db/connection.js:31,43-48), so the settings must be held in memory in the mailroom, loaded from the database, and refreshed by the save path. Two latent bugs surface under criterion 4. isBusinessHour uses `hour <= closeHour` (sla.js:54-56), so Monday 09:00 to Tuesday 09:00 NY counts 540 minutes, not 480. startOfNextHour steps on UTC hour boundaries (sla.js:58-66), so Asia/Kolkata counts 08:30 to 17:00 as 450 minutes instead of 480. The cron finance export (legacy/export/nightly-csv.js:32-37, 60-67) also captures the zone at require time and runs in its own process, so it must load the saved settings before it queries sla_report. The plan is a mailroom-owned single-row business_hours table and model that clears the SLA cache in afterSave, plus a legacy settings module and report(cb). These sit behind typed adapter wrappers that feed new settings and reports routers in the API, alongside the contract changes and a web Settings page.

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-50` on branch `worktree-wf_b6af7eba-389-50` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-50/apps/api/src/settings/settings.test.ts`](../.claude/worktrees/wf_b6af7eba-389-50/apps/api/src/settings/settings.test.ts)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project api src/settings/settings.test.ts
  ```

- **Observed on main:** 1 failed — `expected 200 "OK", got 404 "Not Found"`
- **Why that is the right failure:** supertest fails the status assertion with `expected 200 "OK", got 404 "Not Found"`. No settings router is mounted (apps/api/src/app.ts:19-23), so the request falls through to unknownRoute (apps/api/src/http.ts:39-41) and gets {"error":"No such route"}. That is the spec's gap: the settings exist only as constants in legacy/config.js:51-57, with no way to read or change them. The companion legacy case in legacy/test/sla.test.js (Monday 09:00 to Tuesday 09:00 NY) fails on main with `expected 540 to be 480`, because legacy/lib/sla.js:55 counts the 17:00 hour.

### Where the fix goes

- [`apps/api/src/app.ts:19`](../apps/api/src/app.ts) — Execution path of the observed 404: the router mounts (lines 19-23) are tickets, tags, canned replies, teammates and mail. There is no settings or reports router, so the request falls through to unknownRoute at line 24.
- [`apps/api/src/http.ts:39`](../apps/api/src/http.ts) — Execution path: unknownRoute (lines 39-41) raises HttpError(404, 'No such route'), which is the 404 the test observes.
- [`legacy/config.js:52`](../legacy/config.js) — Traced path: the SLA settings are a literal object (lines 52-57: hours 8, openHour 9, closeHour 17, America/New_York), read once at require time, and no table stores them, so there is nothing to GET or PUT.
- [`apps/api/src/legacy-adapter.ts:30`](../apps/api/src/legacy-adapter.ts) — Traced path: the LegacyMailroom interface exposes only sla.forTicket, with no wrapper for reading or saving settings or for an SLA report. Only this file may import legacy/.
- [`packages/contract/openapi.yaml`](../packages/contract/openapi.yaml) — Traced path: grep finds no /settings or /reports paths, so the contract and generated types lack the new operations (criterion 7).

### Open questions for you

The plan proceeds on the assumption shown; answer only where you disagree.

- **Nightly finance export: (a) should deskDay follow the saved time zone or stay on America/New_York; (b) should the CSV's business_minutes follow the saved hours or stay on the defaults; (c) will you tell finance in writing that business_minutes drops by 60 per business day spanned past 17:00 because of criterion 4? This blocks shipping, not implementation.**  
  Assumed: (a) and (b) both stay on config.sla defaults, and the export ignores saved settings. business_minutes is computed in JS with businessHours.defaults(), and deskDay, the columns and the filter are untouched. (c) The user announces the change to finance before deploy.
- **Should the web badge's 'd' unit use the configured day length (closeHour - openHour), or stay at 8 hours?**  
  Assumed: It stays at 8 hours (480 minutes), and sla-badge.tsx is unchanged.
- **What counts as a 'valid IANA zone', and how is it stored?**  
  Assumed: Any name Intl.DateTimeFormat accepts, except offset strings matching /^[+-]?\d/, stored exactly as typed. UTC, US/Eastern, EST and a lower-case america/new_york are accepted, and the stored value comes back as entered. +05:00 and Mars/Olympus are rejected.
- **Should GET /api/reports/sla count 'now' from the mailroom clock or from the sla_report view's SQLite time?**  
  Assumed: From the mailroom clock (legacy/lib/clock.js), computed in JS, so legacy tests can freeze it.

### Risks

- Settings writes must go through the mailroom (adapter, then legacy model) and clear every sla:* cache entry. Otherwise tickets that were already read keep their old dueAt, which fails criterion 3 only for those tickets. Never use closeLegacy() to clear the cache.
- Both sla.js and nightly-csv.js build Intl formatters with the time zone at require time. Changing open or close hours appears to work while the zone silently stays America/New_York.
- The cron export runs in its own process. It must load the saved settings before querying sla_report, or business_minutes() uses the defaults. Don't change the CSV columns or the state='resolved' filter (issue #142).
- The `< closeHour` fix changes SLA results for every ticket. Some seeded or closed tickets may switch between met and missed, and future export business_minutes drop by 60 per business day. Finance may need to know.
- Time-zone validation: Intl.DateTimeFormat accepts offsets like '+05:00' and names in any case, while Intl.supportedValuesOf rejects 'UTC' and 'Asia/Kolkata' on Node 26. Combine a DateTimeFormat try/catch with an offset regex.
- Settings live in the shared per-file database and in the mailroom's in-memory copy, and CI shuffles test order. Restore the defaults in afterEach in every test that PUTs settings.
- business_minutes is registered deterministic: true, but it now depends on changeable settings. The risk is low (no indexes or generated columns use it), but consider dropping the flag.
- addBusinessMinutes loops forever if no hour is ever open. The API validation prevents that, but the mailroom should also guard against bad rows.
- FD-04 edits the same sla.js functions and FD-10 touches the state column. Expect merge conflicts in legacy/lib/sla.js.
- The web badge's 'd' unit still assumes an 8-hour day. That is an open question, and existing web tests pin it.

## FD-08: Port the automation rules to TypeScript

**Kind:** missing-feature · **Size:** L · ★ core · **Plan:** [`tmp/plans/FD-08.md`](plans/FD-08.md) · **Spec:** [`specs/FD-08.md`](../specs/FD-08.md)

**Plan review:** 2 junior-engineer round(s), ready with 0 blocking questions (12 non-blocking notes left in the plan) · **Failing test:** verified on attempt 1 of 1

None of the five automation rules has a TypeScript version. apps/api/src/rules/ does not exist, so `npm run rules:parity` says "typescript not written yet" for every rule while the legacy versions match all 40 golden cases. The fix is a straight port: five self-contained modules, a small shared types/helper module and a golden-replay unit test. No change to the contract, API routes, database, mailroom, cron jobs, finance export or seed data.

### Root cause

What's missing is apps/api/src/rules/<name>.ts for reopen-on-reply, tag-billing, escalate-vip, assign-round-robin and auto-close-stale. scripts/rules-parity.ts:140-147 looks only there and takes `mod.rule ?? mod.default`. Each port has to reproduce the legacy rule exactly. That means: the `{name, when, run(ticket, ctx, cb?)}` shape; effects in the same order, compared with isDeepStrictEqual; the 7- and 14-day boundaries (>= and > respectively); the regexes without a `g` flag; and the round-robin rotation carrying across calls on one rule instance, with a fresh ctx per case. The rules may use only `ticket` and `ctx` and must import nothing from legacy/, including through legacy-adapter.ts. They must work both with the parity harness's ctx (callback plus promise) and with the mailroom's callback-only ctx. That is why the plan has a `perform` helper and a `defineRule` wrapper that honours an optional cb. None of the traps applies directly, because all writes go through ctx: the status/state mirror and the SLA cache are handled by Ticket.updateStatus/save in the legacy ctx, and the crontab sweep and finance export stay on the mailroom. Switching the mailroom over to the ported rules is out of scope.

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-55` on branch `worktree-wf_b6af7eba-389-55` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-55/apps/api/src/rules/rules.test.ts`](../.claude/worktrees/wf_b6af7eba-389-55/apps/api/src/rules/rules.test.ts)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project api src/rules/rules.test.ts
  ```

- **Observed on main:** 5 failed — `apps/api/src/rules/reopen-on-reply.ts exports \`rule\` or a default: expected undefined to be 'reopen-on-reply'` (one per rule)
- **Why that is the right failure:** On main the run shows five failures, each `AssertionError: apps/api/src/rules/<name>.ts exports `rule` or a default: expected undefined to be '<name>'`. The existsSync guard turns a missing module into an assertion failure rather than a module-not-found error. This is the right reason because the piece the spec says is missing is exactly a module at that path that exports a rule with that name. Once the module exists, the same test checks golden-case parity (AC 1 and AC 2).

### Where the fix goes

- [`scripts/rules-parity.ts:140`](../scripts/rules-parity.ts) — Tier 1 (the loader on the path): lines 140-147 build apps/api/src/rules/<name>.ts and take `mod.rule ?? mod.default`, so the ports have to live there and export that way. The new test copies this lookup.
- [`apps/api/src/rules/reopen-on-reply.ts`](../apps/api/src/rules/reopen-on-reply.ts) — Tier 1: this file does not exist, which is the direct cause of the reopen-on-reply failure. Likewise tag-billing.ts, escalate-vip.ts, assign-round-robin.ts and auto-close-stale.ts in the same folder (and a shared rule.ts helper, per the plan).
- [`legacy/rules/assign-round-robin.js:8`](../legacy/rules/assign-round-robin.js) — Tier 2 (behaviour to mirror): the rotation lives in module-level `let next = 0`. Lines 24-28 return for spam or an empty teammate list without advancing it. The rotation must carry across calls on one instance.
- [`legacy/rules/reopen-on-reply.js:32`](../legacy/rules/reopen-on-reply.js) — Tier 2: `closedFor > REOPEN_WITHIN_DAYS * DAY` (14 days at line 12), so a ticket closed exactly 14 days ago reopens. A null closed_at behaves like the epoch.
- [`legacy/rules/auto-close-stale.js:30`](../legacy/rules/auto-close-stale.js) — Tier 2: `idle < waitDays * DAY` returns early, so a ticket idle exactly 7 days (14 for VIP, lines 11-12 and 28) is closed. Time comes from ctx.now, and the log line is at :31.

### Open questions for you

The plan proceeds on the assumption shown; answer only where you disagree.

- **Is it acceptable for the TS rules to be promise-based internally, with a defineRule wrapper that also calls an optional callback, rather than callback style that mirrors the mailroom one-to-one?**  
  Assumed: Promise-based, with defineRule/perform as described in step 1.
- **Should assign-round-robin keep the mailroom's per-process, in-memory rotation, or should the rotation be persisted?**  
  Assumed: In memory, as parity requires. Persisting it is a behaviour change for the switch-over item.
- **Do you want an apps/api/src/rules/index.ts that lists the rules in the mailroom's order now?**  
  Assumed: No index.ts in this item.
- **How should FD-08 coordinate with FD-03 (round-robin flakiness) and FD-09 (new tagging rules and fixtures)?**  
  Assumed: Independent branches. The AC 4 check diffs against the merge base, so FD-03 can land first. If FD-08 lands first, FD-03 rebases.
- **CLAUDE.md's definition of done needs `npm run feature:check -- FD-08`, but the workflow rules forbid agents from running it. Who runs it?**  
  Assumed: The user runs it in the implementation worktree after DoD-1 to DoD-6 pass. The implementing agent stops at DoD-6 and reports DoD-7 as outstanding.

### Risks

- The round-robin rotation has to persist on one imported instance for parity, but CI shuffles tests (the FD-03 trap). Export a createAssignRoundRobin() factory plus a `rule` singleton, replay all of its cases in one `it`, and use vi.resetModules() or a fresh instance in every test.
- AC4 forbids touching legacy/rules/ or fixtures/rules/, even to fix the module-level round-robin state. That fix belongs to FD-03, and the merge order of FD-03 and FD-08 matters.
- An `async run` that does `await ctx.assign(id)` passes parity but resolves before the write finishes against the mailroom's callback-only ctx. Route every ctx call through a perform() helper that accepts a callback or a promise.
- AC3 is stricter than the repo boundary: no imports of legacy/ or legacy-adapter.ts, no reuse of clock.js or context.js types, no re-exporting the CommonJS rule. Keep 'legacy' out of every import specifier.
- Exact boundaries and coercions: > 14 days for reopen, >= 7/14 days for auto-close, !assignee_id, Boolean(vip), effect ordering, and no extra keys in effects.
- Adding the g flag to the tag-billing regexes would make .test() stateful through lastIndex.
- npm run check typechecks acceptance/tsconfig.json, which I did not read. Keep the exported types permissive: done optional, ctx mutators returning Promise<void> | void, Teammate.email optional.
- Strict TS (noUncheckedIndexedAccess, verbatimModuleSyntax, .ts import extensions, no-explicit-any) applies to the new files. The prototype passed tsc, ESLint and Prettier with the repo configs.
- Wire nothing into server.ts, the mailroom ingest, sweep-rules.js or ops/crontab. Switching over is a later item, and the state/status mirror and SLA cache stay handled by the legacy ctx.
- Under CI's shuffled order, npm run check still fails on the known legacy/test/rules/assign-round-robin.test.js (KNOWN_FAILURES.md). Report it as known.

## FD-09: Auto-tag incoming mail

**Kind:** missing-feature · **Size:** M · ★ core · **Plan:** [`tmp/plans/FD-09.md`](plans/FD-09.md) · **Spec:** [`specs/FD-09.md`](../specs/FD-09.md)

**Plan review:** 1 junior-engineer round(s), ready with 0 blocking questions (14 non-blocking notes left in the plan) · **Failing test:** verified on attempt 1 of 1

No rule tags new mail as shipping, account, printing or spam. The only rule that sets a category is tag-billing, which only knows money words, so a replay of the seeded inbox with rules on agrees with the teammates' category tags on just 5 of 26 tickets. The fix is a sixth mailroom rule, `auto-tag`, in `legacy/rules/`. It categorizes inbound mail, adds nothing when no category fits, and skips tickets that already carry a category tag. It runs before tag-billing and assign-round-robin, and all three arrival paths (poller, `mail:drop`, Simulate) reach it through `ingest.afterIngest`. A keyword prototype in scratch agreed with the teammates on 26 of 26 seeded tickets.

### Root cause

The feature is missing: nothing assigns `shipping`, `account`, `printing` or `spam`. The rule list (`legacy/rules/index.js:21-27`) contains only reopen-on-reply, tag-billing, escalate-vip, assign-round-robin and auto-close-stale. Of these, only tag-billing (`legacy/rules/tag-billing.js:8-9,27`) adds a category, and only for money words. Every arrival path ends at `legacy/ingest/ingest.js:127-133`, which calls `rules.applyTo` and is gated by `config.rulesEnabled` (on by default, `legacy/config.js:43`): - the poller (`poller.js:35-50`); - `npm run mail:drop`, which only copies a file into the inbox (`drop.js:54-66`); - the Simulate button, which calls `dropFixture` and then `pollInbox` (`mail-router.ts:35,40,56-58`). So the change belongs in the mailroom's rule list: - a new `legacy/rules/auto-tag.js`; - a registration in `index.js` after reopen-on-reply, before tag-billing and assign-round-robin; - a required golden fixture, `fixtures/rules/auto-tag.json`, because `golden.test.js:14-20` requires one fixture per rule. The rule writes only `ticket_tags`, through `ctx.addTag` (`context.js:115-131`, INSERT OR IGNORE, which never removes a tag). That means no contract, API, web, schema, state/status mirror, SLA cache, crontab or finance-export change is needed. Criterion 5 is met by skipping tickets that already have a category tag. `ticket_tags` has no column recording who set a tag (`apps/api/src/db/schema.sql:10-14`), so this can't be done from the data.

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-39` on branch `worktree-wf_b6af7eba-389-39` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-39/legacy/test/rules/auto-tag.test.js`](../.claude/worktrees/wf_b6af7eba-389-39/legacy/test/rules/auto-tag.test.js)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project legacy legacy/test/rules/auto-tag.test.js
  ```

- **Observed on main:** 1 failed — `expected [] to include 'shipping'`
- **Why that is the right failure:** AssertionError: expected [] to include 'shipping'. On main, rules.applyTo runs every existing rule. None produces a shipping category, and tag-billing doesn't match because the text has no money words, so the ticket ends with no tags. I reproduced this scenario in a throwaway database: tags []. That is the spec's complaint that new mail is not categorized. It isn't an import or syntax error, because legacy/rules/index.js exists and applyTo runs.
- **Verifier notes (not blocking):**
  - Minor, not blocking: the test calls rules.applyTo directly, not the ingest path. An implementation that tags somewhere outside the rule list, such as directly in legacy/ingest/ingest.js, would satisfy criterion 1 but still fail this test. That matches the documented design, where every arrival path ends at rules.applyTo through ingest.js afterIngest, so it is acceptable.
  - Minor, not blocking: the test covers only the positive shipping case. It does not cover criterion 2 (no category tag for unrelated mail), criterion 3 (spam) or criterion 5 (a follow-up never removes or replaces a teammate's tags). That is fine for a single failing test that demonstrates the missing feature, but the implementation will need more tests.

### Where the fix goes

- [`legacy/rules/index.js:21`](../legacy/rules/index.js) — Inferred from the execution path: the RULES array at lines 21-27 is what applyTo runs over, and none of its five rules writes shipping, account, printing or spam. The new auto-tag rule needs to be registered here, after reopen-on-reply and before tag-billing and assign-round-robin.
- [`legacy/rules/tag-billing.js:8`](../legacy/rules/tag-billing.js) — Inferred from the execution path: the only rule that adds a category tag, and only for money words (regex at lines 8-9, addTag at 27). It is the pattern a new rule would follow, with its when() checking for an inbound message at lines 15-17.
- [`legacy/rules/context.js:115`](../legacy/rules/context.js) — Inferred from the execution path: addTag is the only way a rule can write a tag. It uses INSERT OR IGNORE, never removes a tag, and does nothing if the tag row is missing, which is why the test seeds all six tags.
- [`legacy/ingest/ingest.js:127`](../legacy/ingest/ingest.js) — Inferred from the execution path: the single place where the poller, mail:drop and the Simulate button all reach rules.applyTo (lines 127-133), gated by config.rulesEnabled (legacy/config.js:43). That is why the fix belongs in the rule list.
- [`legacy/test/rules/golden.test.js:14`](../legacy/test/rules/golden.test.js) — Imported by the path: requires one fixtures/rules/<name>.json for each rule (lines 14-20), so a new rule without fixtures/rules/auto-tag.json would turn npm run check red.

### Risks

- 0041, the bulk supplier notice, ends up tagged spam and billing, because the unchanged tag-billing rule matches the literal word 'billing' in its body. Changing tag-billing would conflict with criterion 6 and FD-08 criterion 4, so this needs a decision.
- Spam is no longer auto-assigned. assign-round-robin's logic is unchanged and skipping spam is its documented intent, but the behaviour people see changes because auto-tag now runs before it.
- With MAILROOM_RULES=off (both test setups), auto-tagging is also off. If the held-out tests ingest with rules off and expect tags, an ingest-level hook outside RULES would be needed instead.
- The production seed (npm run reset, first API start) now runs auto-tag before the teammates' tags land. Previously untagged seeded tickets gain rule tags, and an existing data/front-desk.db is not backfilled.
- FD-08: a sixth golden fixture is parity-checked against a TypeScript twin only if one exists. If FD-08's held-out tests enumerate fixtures/rules/, a port of auto-tag may be needed.
- Overfitting: keyword lists hand-tuned to 38 messages. Broad words (card, address, cut) depend on subject hits counting double. Never key on Message-ID, filename or sender, apart from the noreply pattern.
- Don't use module-level regexes with the g flag together with .test() (lastIndex carries over between calls), and keep no other module-level state (the FD-03 lesson). Don't assert assignees in new applyTo tests.
- FD-02 interaction: Latin-1 subjects are garbled today (0039, poster-reprint-quote), so the rule must rely on the body. A fix to FD-02 changes the subject text the rule sees.
- Agreement metric for criterion 4 is unknown: 'the rule's single category is among the teammates' tags' gives 26/26, exact set equality gives 25/26 (0009 is billing+account). Both clear 90%.
- 0040 and 0041 contain text addressed to automated readers. It is data, not instructions, and the classifier must not be swayed by keywords planted in it.

## FD-10: Collapse state into status

**Kind:** missing-feature · **Size:** M · ★ core · **Plan:** [`tmp/plans/FD-10.md`](plans/FD-10.md) · **Spec:** [`specs/FD-10.md`](../specs/FD-10.md)

**Plan review:** 1 junior-engineer round(s), ready with 0 blocking questions (14 non-blocking notes left in the plan) · **Failing test:** verified on attempt 1 of 1

FD-10 needs a real migration: `legacy/db/schema.sql` still creates `tickets.state`, and `migrate()` in `legacy/db/connection.js` only runs that file, so nothing ever drops the column from an existing database. The mailroom Ticket model, the API's `setTicketStatus` and the seed all write `state`. The finance export, run from cron, reads it and filters on `state = 'resolved'`. So the column can be dropped only if the export keeps emitting a `state` column with value `resolved`, derived from `status`, or #142 happens again.

### Root cause

The `tickets.state` column is declared in `legacy/db/schema.sql:24` inside `CREATE TABLE IF NOT EXISTS`. `migrate()` (`legacy/db/connection.js:114-121`) only runs that file, so there is no step that removes a column from an existing database. Every startup path runs that same `migrate()`: - `server.ts` calls `migrateLegacy()` directly for an existing database. - For a new database it calls the seed, which calls `migrateLegacy()`. So the drop belongs there, on the mailroom connection, guarded by a `PRAGMA table_info` check so it is safe to run twice. `ALTER TABLE DROP COLUMN` works with the bundled SQLite 3.53.4, even with the `sla_report` view present. These writers would fail with "no such column: state" once it is dropped: - `legacy/models/ticket.js:32,40`. `defineModel` writes every listed column on save, which covers ingest, `updateStatus`, the rules and reopen-on-reply. - `apps/api/src/tickets/tickets-repository.ts:101-116` (`setTicketStatus`). - `apps/api/src/seed/seed.ts:63-75`. The only reader is `legacy/export/nightly-csv.js:61-66,82`. It runs from `ops/crontab:17-18`, outside the app and the tests. Finance's import keys on the `state` column and the value `resolved` (`docs/history/issues/142.md`). To meet AC4 the export must derive `state` from `status` with a CASE expression, filter on `status = 'closed'`, and produce byte-identical CSV whether or not the column has been dropped yet. The web app and the OpenAPI contract never mention ticket `state`; the only `state` in the contract is the SLA state, which is a different thing. The SLA cache needs no change, because `state` is not part of the SLA snapshot.

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-26` on branch `worktree-wf_b6af7eba-389-26` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-26/legacy/test/migrate.test.js`](../.claude/worktrees/wf_b6af7eba-389-26/legacy/test/migrate.test.js), [`.claude/worktrees/wf_b6af7eba-389-26/legacy/test/export.test.js`](../.claude/worktrees/wf_b6af7eba-389-26/legacy/test/export.test.js)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project legacy legacy/test/migrate.test.js legacy/test/export.test.js
  ```

- **Observed on main:** 1 failed | 1 passed — `expected [ Array(9) ] to not include 'state'` (the passing test is the export guard and is meant to pass)
- **Why that is the right failure:** AssertionError: expected [ 'id', 'subject', 'customer_id', 'assignee_id', 'status', 'state', 'created_at', 'updated_at', 'closed_at' ] not to include 'state'. This is the right reason because on main migrate() only runs CREATE TABLE IF NOT EXISTS from schema.sql and never removes the column from an existing database (AC1/AC2). It is an assertion failure, not an import or syntax error, and the row-preservation assertions already pass on main.

### Where the fix goes

- [`legacy/db/connection.js:114`](../legacy/db/connection.js) — Code path traced: migrate() (lines 114-121) only execs schema.sql, so an existing tickets.state column is never removed. The new test's failure lands here; the drop belongs here, guarded by PRAGMA table_info so it is safe to run twice.
- [`legacy/db/schema.sql:24`](../legacy/db/schema.sql) — Code path traced: `state TEXT NOT NULL DEFAULT 'active'` inside CREATE TABLE IF NOT EXISTS means new databases still get the column.
- [`legacy/models/ticket.js:32`](../legacy/models/ticket.js) — Code path traced: 'state' is in the model's column list and beforeSave sets it (line 40). Once the column is dropped, every Ticket save (ingest, updateStatus, rules, reopen on reply) would fail with 'no such column: state' (AC3).
- [`legacy/export/nightly-csv.js:61`](../legacy/export/nightly-csv.js) — Code path traced: selects t.state and filters WHERE t.state = 'resolved' (lines 61-66, 82). It must derive state from status with no change to the CSV bytes, or it repeats #142. export.test.js guards this.
- [`apps/api/src/tickets/tickets-repository.ts:101`](../apps/api/src/tickets/tickets-repository.ts) — Code path traced: setTicketStatus writes `state = ?` via STATE_FOR_STATUS (lines 101-116), which would break once the column is gone.

### Risks

- Repeating #142: grepping the TypeScript finds no reader of state, but the cron-run nightly-csv.js reads it. The export must keep the header, column order and the value 'resolved' byte-identical by deriving state from status. Do not just delete t.state from the query.
- Deploy order on mail-01: cron runs the new code before the API restart migrates the database. The new export (a derived CASE expression) and the new Ticket model (state not in its columns) must work against both the old and the new schema.
- Possible drift between state and status in production, from the #139 drop and #143 re-add with DEFAULT 'active'. Deriving state from status would then change today's export. Count the mismatched rows (and maybe log them) before dropping.
- DROP COLUMN cannot go in schema.sql because it fails on a second run. It must be a guarded JS step in legacy/db/connection.js migrate(), in CommonJS with callbacks, on the mailroom connection, not on the API connection.
- Config is read once: FINANCE_EXPORT_DIR must be set in legacy/test/setup.js. Setting it inside the test file is too late, and the CSV would land in the repository's exports/.
- Out of scope, nearby: setTicketStatus does not clear the sla:<id> cache. If someone fixes it, add a cache.del wrapper in legacy-adapter.ts and never use closeLegacy().
- FD-06 also changes the export (it appends priority). Keep the derived state column if both land.
- Known failure: assign-round-robin.test.js (FD-03) fails only in shuffled orders.

## FD-11: Merge duplicate tickets

**Kind:** missing-feature · **Size:** L · ★ core · **Plan:** [`tmp/plans/FD-11.md`](plans/FD-11.md) · **Spec:** [`specs/FD-11.md`](../specs/FD-11.md)

**Plan review:** 2 junior-engineer round(s), ready with 0 blocking questions (11 non-blocking notes left in the plan) · **Failing test:** verified on attempt 2 of 2

Merging is entirely absent: no contract operation, no API route (POST /api/tickets/1/merge returns 404 "No such route", reproduced), no merge record in the schema, no web control. Two mailroom behaviours also break AC11 and AC9 after a merge. A [#<merged id>] subject token threads onto the hidden shell, and a reply from a second address at the same company opens a new ticket (reproduced) because of the exact customer_id check in ingest.js:76.

### Root cause

Nothing implements merging. The contract (packages/contract/openapi.yaml) has no /tickets/{ticketId}/merge, and tickets-router.ts has no route, so the request falls to unknownRoute (http.ts:39-41, mounted at app.ts:24) and returns 404. listTicketRecords has no way to hide a ticket. The mailroom schema has nothing that records a merge. In legacy/ingest/ingest.js, findBySubject (:44-48) resolves [#id] with Ticket.find and never follows a merge, and line 76 accepts a thread only when the sender's customer_id matches the ticket's, so a cross-address reply after an AC9 merge opens a new ticket. AC7 needs the survivor to take min(created_at), which is an API-side write. The SLA snapshot is cached under sla:<id> (legacy/lib/sla.js:182-193) and cleared only by Ticket.afterSave, and the adapter has no per-ticket clear (legacy-adapter.ts:29), so a new clearSlaCache wrapper is required. The hourly sweep (legacy/bin/sweep-rules.js:15, from ops/crontab) would run the rules on hidden shells. If a shell got closed, it would enter the finance CSV (nightly-csv.js:61-67, issue #142), so the plan leaves the shell's status, state and closed_at untouched. Recommended design: a new mailroom table ticket_merges (idempotent CREATE TABLE IF NOT EXISTS, with a TicketMerge model) and one synchronous API transaction that moves messages, outbox rows and tags. Ingest resolves merged ids and accepts senders who already wrote inbound on the thread. The web app gets an input and a confirm dialog, then navigates to the survivor.

### Failing test

- **Worktree:** `.claude/worktrees/wf_b6af7eba-389-61` on branch `worktree-wf_b6af7eba-389-61` (uncommitted)
- **Test files:** [`.claude/worktrees/wf_b6af7eba-389-61/apps/api/src/tickets/tickets-merge.test.ts`](../.claude/worktrees/wf_b6af7eba-389-61/apps/api/src/tickets/tickets-merge.test.ts)
- **Run (from the worktree root):**

  ```bash
  TZ=UTC npx vitest run --project api apps/api/src/tickets/tickets-merge.test.ts
  ```

- **Observed on main:** 1 failed — `expected 200 "OK", got 404 "Not Found"`
- **Why that is the right failure:** On main: `Error: expected 200 "OK", got 404 "Not Found"` at the merge POST's .expect(200). No merge route exists (tickets-router.ts:26-79), so the request falls through to unknownRoute (apps/api/src/http.ts:39-41, mounted at app.ts:24) and returns {"error":"No such route"}. That is the right reason: the merge operation the spec requires is missing. Imports, compilation, the receive() calls and both GETs all succeed on main.

### Where the fix goes

- [`apps/api/src/tickets/tickets-router.ts:26`](../apps/api/src/tickets/tickets-router.ts) — Inference (traced execution path): ticketsRouter (lines 26-79) registers GET /tickets, GET /tickets/:ticketId, PATCH status, PUT assignee and POST replies, but no POST /tickets/:ticketId/merge, so the request is never handled here.
- [`apps/api/src/http.ts:38`](../apps/api/src/http.ts) — Inference (traced path, matches observed body): unknownRoute (lines 38-40) calls next(new HttpError(404, 'No such route')), which is the exact 404 body the probe observed.
- [`apps/api/src/app.ts:24`](../apps/api/src/app.ts) — Inference (traced path): api.use(unknownRoute) is mounted after all feature routers, so an unregistered /api/tickets/:id/merge falls through to it.
- [`packages/contract/openapi.yaml:30`](../packages/contract/openapi.yaml) — Inference (contract): there is no /tickets/{ticketId}/merge path or MergeInput schema, so the merge operation that AC2 requires is missing from the contract the API must match.
- [`apps/api/src/tickets/tickets-repository.ts:60`](../apps/api/src/tickets/tickets-repository.ts) — Inference (downstream of the fix, not reached on main): listTicketRecords applies only optional filters and has no way to hide a merged ticket, so the AC4 loop would fail here once a merge route exists unless it excludes merged ids.

### Open questions for you

The plan proceeds on the assumption shown; answer only where you disagree.

- **What counts as 'the same company' (AC9), and which status rejects different customers (AC8)?**  
  Assumed: Exact same email domain (no subdomain matching), excluding shared providers including example.com; rejected with 400 {"error":"Only tickets from the same customer can be merged"}.
- **Assignee (AC6): when both tickets are assigned, or only the merged one is, who ends up assigned?**  
  Assumed: The survivor keeps its own assignee, and inherits the merged ticket's only if it has none.
- **Survivor status: if one side is closed and the other open, should the survivor be reopened?**  
  Assumed: The survivor's status is unchanged.
- **The merged ticket's own status and the finance export: leave it, or close it and filter the export?**  
  Assumed: Leave status/state/closed_at untouched. The export is unchanged and never references ticket_merges.
- **What does a merged ticket id do on the API: 404, or does GET return the survivor?**  
  Assumed: 404 on every per-ticket endpoint. GET's message is 'Ticket N was merged into #M', which the web page shows for stale links. Writes 404 either way.
- **Merging a ticket that is already merged, or into one: 404, 400, or follow to the survivor?**  
  Assumed: 404.
- **Should the survivor's subject change?**  
  Assumed: No.
- **After a cross-address merge, should outbound replies also reach the merged-from address?**  
  Assumed: No. Replies go only to the survivor's customer address (legacy/outbox/mailer.js:65).
- **Confirmation UI and labels for AC1/AC12: window.confirm or an in-page dialog?**  
  Assumed: window.confirm('Merge #<id> into #<n>? This can't be undone.'), with an input labelled 'Merge into ticket #' and a 'Merge' button.

### Risks

- Stale SLA on the survivor: any API write to its created_at/status/closed_at must call the new clearSlaCache(id) adapter wrapper (cache.del('sla:'+id)), never closeLegacy(); copying setTicketStatus's pattern would miss it.
- Finance export (#142): closing the merged ticket would push a duplicate state='resolved' row into the nightly CSV; leave the shell's status/state/closed_at alone, and if the survivor's status changes, write state too.
- Cron jobs run without the API or a migrate call: a query referencing ticket_merges fails on mail-01 until the API has started once on the new code; restart the API before the next sweep, or have sweep-rules.js migrate first.
- sweep-rules.js and rules.applyTo must skip merged shells, or assign-round-robin spends a rotation slot on a hidden ticket and auto-close-stale may close it into the export.
- Relaxing ingest.js:76 changes who can thread onto a ticket; only senders who already wrote inbound on the thread may be accepted, keeping legacy/test/ingest.test.js:122 green.
- The merge transaction on the API connection must be fully synchronous (no await between BEGIN IMMEDIATE and COMMIT) or it blocks the in-process mailroom connection until busy_timeout and SQLITE_BUSY.
- Same-company rule is underspecified: example.com hosts unrelated people in the seed and in every API test, so a bare domain match would merge strangers; keep the rule in one function and confirm it with the user.
- Legacy tests touching merges must add ticket_merges to their beforeEach cleanup to stay order-independent under CI shuffling.
- ticket_merges is a mailroom-schema table that the API writes; note the ownership in docs/architecture.md and CLAUDE.md.
- Cross-item interactions: FD-01 tag counts (move tags off the shell), FD-04 pause history, FD-06 priority, FD-07 sla_report/report endpoint listing shells, FD-10 (don't add new state writers).
