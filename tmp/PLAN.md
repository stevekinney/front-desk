# Plan: FD-03, make the round-robin unit test pass in any order

Status: test plan approved by the user on 2026-10-06 (T1–T10 as written; T11 as described below).
Reviewed twice by junior-engineer.

Spec: `specs/FD-03.md`. Acceptance: `acceptance/FD-03.test.ts`, run by `npm run feature:check -- FD-03`.

## Root cause (established)

`legacy/rules/assign-round-robin.js:8` keeps `let next = 0` at module scope. Every test in
`legacy/test/rules/assign-round-robin.test.js` shares one copy of the module (loaded once through
`createRequire`, test lines 6–7), and the tests hard-code the teammate each ticket gets. Those
answers are only right if the tests run in declaration order:

| Test (declaration order)                     | Expects          | Counter value it assumes on entry |
| -------------------------------------------- | ---------------- | --------------------------------- |
| only looks at open tickets that nobody has   | `when` only      | n/a (never calls `run`)           |
| gives the first ticket to the first teammate | assign 1         | 0                                 |
| gives the next ticket to the next teammate   | assign 2         | 1                                 |
| leaves spam for the spam folder              | no effects       | n/a (spam returns before `next`)  |
| wraps around after the last teammate         | assign 3, then 1 | 2                                 |
| does nothing when nobody is on the desk      | no effects       | n/a (empty roster returns first)  |

Vitest's `--sequence.shuffle` also shuffles the tests inside a file, so in most seeds the counter is
wrong when a test starts. Evidence gathered on 2026-10-06:

- The file fails on its own on seeds 2, 3, 5, 7, 9, 10, 11, 12, 15, 17, 18, 20 out of 1–20. Those
  are the same seeds that fail when the whole suite runs, so nothing leaks in from other files.
- `npm run smoke -- --seed 2` gave 104 of 106 passed, with 2 failures, both in this file.
- In the whole suite over seeds 1–40, only this file ever failed (29 of 40 seeds).
- The default order passes 106/106, and so do three non-UTC time zones.
- The last two CI runs on `main` (GitHub Actions runs 37516692093 and 37480678264) failed only at
  the `tests` step, on this file, on both Node 24 and Node 26. Their seeds were 98848 and 21148 (the
  latest run) and 76328. Source: `gh run view <id> --log-failed`.

## Constraints

- **C1 (spec 3).** No test is deleted, skipped or loosened. The round-robin file keeps all 6 tests
  and every expected teammate id it asserts today. The suite keeps at least 106 passing tests.
- **C2 (spec 4).** Production behaviour does not change, so `legacy/rules/` is not edited. The
  counter must keep carrying over between calls in one process. `scripts/rules-parity.ts` and
  `legacy/test/rules/golden.test.js` both rely on that. In `fixtures/rules/assign-round-robin.json`,
  cases 2, 3, 6, 7, 8 and 10 (tickets 125, 126, 129, 130, 131 and 133) only pass if the counter
  carries over. Case 3 checks that spam does not use up a turn.
- **C3.** The fix lives in test code only. The rule does not gain an exported reset hook.
- **C4 (spec 5).** The round-robin entry is removed from `KNOWN_FAILURES.md`.

## Change

Two files are edited by hand: `legacy/test/rules/assign-round-robin.test.js` and
`KNOWN_FAILURES.md`. `npm run feature:check -- FD-03` also flips FD-03's `passes` in
`features.json`, by design.

### 1. Give every test a freshly loaded rule

In `legacy/test/rules/assign-round-robin.test.js`:

- Keep the `createRequire` import and `const require = createRequire(import.meta.url);` (lines 1
  and 6). The new code needs that `require` for `require.resolve` and `require.cache`.
- Add `beforeEach` to the `vitest` import.
- Replace only line 7, `const rule = require('../../rules/assign-round-robin');`, with:
  ```js
  const rulePath = require.resolve('../../rules/assign-round-robin');
  /** @type {any} */
  let rule;
  ```
- Add this as the first statement inside `describe('assign-round-robin', ...)`:
  ```js
  // The rule keeps its rotation in module state, so load a fresh copy for every test.
  beforeEach(() => {
    delete require.cache[rulePath];
    rule = require(rulePath);
  });
  ```
- Why this works: the rule has no `require`s of its own, so evicting its single cache entry gives a
  module whose `next` is 0. Vitest isolates test files by default (`vitest.config.ts` doesn't
  override `pool` or `isolate`), so `golden.test.js` and `rules/index.js` keep their own copy.

### 2. Have the two order-dependent tests set up their own history

Each test now starts at counter 0, so two tests must assign the tickets they used to inherit from
earlier tests. Every teammate id they assert today stays the same. Each assertion gets stricter,
because it now checks the whole sequence of assignments.

- **gives the next ticket to the next teammate:** with one `ctx`, apply `ruleTicket({ id: 1 })` and
  then `ruleTicket({ id: 2 })`. Expect `ctx.effects` to equal
  `[{ type: 'assign', teammateId: 1 }, { type: 'assign', teammateId: 2 }]`.
- **wraps around after the last teammate:** with one `ctx`, apply tickets with ids 2, 3, 4 and 5 in
  that order. Expect teammate ids `1, 2, 3, 1`, each as `{ type: 'assign', teammateId: n }`.

The other four tests do not change.

### 3. Clear the known failure

Delete the list item for `legacy/test/rules/assign-round-robin.test.js` from `KNOWN_FAILURES.md`.
Keep the heading and the two paragraphs. `scripts/smoke.ts` reads only backticked list items, so an
empty list works. Once the list is empty, smoke exits 1 on any failing test, so its exit code alone
means green.

## Out of scope

- Any change to `legacy/rules/`, `fixtures/`, `scripts/` or `golden.test.js`. The one exception is
  the temporary, reverted mutation in T4.
- Putting the counter on `ctx`, deriving it from data, or persisting it. Each one breaks parity or
  changes production behaviour.
- The TypeScript port of the rules (FD-08).
- `.gitignore` and `.prettierignore`. This plan file is formatted with Prettier so that
  `npm run check` passes while it sits in `tmp/` (see T8).

## Test plan (needs approval before implementation)

Run the commands exactly as written, from the repository root, in zsh or bash. They call
`node node_modules/vitest/vitest.mjs`, the runner the repo scripts use. T1 runs once
before any edit. T2–T10 run after the final edit, in order, and a step passes only on the stated
result.

**T1: red before the change (baseline).** Before editing, run:

```sh
TZ=UTC node node_modules/vitest/vitest.mjs run --project legacy legacy/test/rules/assign-round-robin.test.js --sequence.shuffle --sequence.seed=2
```

Passes when it exits non-zero and every failure is in this file. On 2026-10-06 it showed
`2 failed | 4 passed (6)`. A different failure count in this file still counts as red, but note it in
the report.

**T2: the round-robin file passes in any order.** Run:

```sh
for s in $(seq 1 100); do TZ=UTC node node_modules/vitest/vitest.mjs run --project legacy legacy/test/rules/assign-round-robin.test.js --sequence.shuffle --sequence.seed=$s >/dev/null 2>&1 || echo "FAIL $s"; done; echo done
```

Passes when the only output is `done`.

**T3: the reset is what makes it pass.** Comment out only the `delete require.cache[rulePath];`
line and rerun the T2 loop. Then uncomment the line and run
`grep -nE '^\s*delete require\.cache\[rulePath\];' legacy/test/rules/assign-round-robin.test.js`.

Passes when the loop prints at least one `FAIL` and the grep prints exactly one line, which shows
the line is active again. This proves the tests depend on a fresh module.

**T4: the tests still check the rotation.** Change `next += 1;` to `next += 0;` in
`legacy/rules/assign-round-robin.js`, then run:

```sh
TZ=UTC node node_modules/vitest/vitest.mjs run --project legacy legacy/test/rules/assign-round-robin.test.js
```

Then run `git checkout -- legacy/rules/assign-round-robin.js` followed by
`git status --short legacy/rules`.

Passes when "gives the next ticket to the next teammate" and "wraps around after the last teammate"
fail, and the final `git status` prints nothing. This is the only time `legacy/rules/` is touched,
and the change is reverted.

**T5: default order (spec 1 and 3).** Run `npm run smoke -- --no-shuffle`.

Passes when the output contains `106 of 106 tests passed` and the exit code is 0.

**T6: whole suite, shuffled the way CI runs it (spec 1).** Run:

```sh
for s in $(seq 1 100) 4242 98848 21148 76328; do npm run smoke -- --seed $s >/dev/null 2>&1 || echo "FAIL $s"; done; echo done
```

This covers seeds 1–100, the seed from the smoke docstring, and the three seeds that failed CI.

Passes when the only output is `done`. It relies on C4 being done first: with `KNOWN_FAILURES.md`
empty, smoke exits 1 on any failing test. Expect about 5 minutes.

**T7: rule behaviour unchanged (spec 4).** Run `npm run rules:parity`.

Passes when it exits 0 and the assign-round-robin section shows `legacy     10/10 cases match`.
`typescript not written yet` is expected.

**T8: everything CI checks.** Run `TEST_SEED=2 npm run check`.

Passes when the summary shows `ok` for lint, format, typecheck, generated files and tests, and the
exit code is 0. If the only failure is formatting in `tmp/PLAN.md`, run
`npx prettier --write tmp/PLAN.md` and rerun the step. Don't edit any ignore file.

**T9: held-out acceptance tests (spec 1, 3, 4 and 5).** Run `npm run feature:check -- FD-03`.

Passes when it prints `PASS  FD-03  (features.json: passes = true)` and exits 0. It reruns the
suite 11 times, so expect a few minutes.

**T10: scope.** Run `git status --short`, `git diff --stat` and `git diff features.json`.

Passes when:

- the only modified files are `legacy/test/rules/assign-round-robin.test.js`, `KNOWN_FAILURES.md`
  and `features.json`;
- the `features.json` diff is the single `"passes": false` → `true` line for FD-03;
- the only untracked entry is `tmp/`.

**T11: CI is green (spec 2). Outward-facing; the user approved this approach on 2026-10-06.**

1. Commit the change on a branch named `fd-03-round-robin-order`, push it to `origin`, and open a PR
   against `main`.
2. Wait for both PR jobs with `gh pr checks --watch`. Passes when `check (Node 24)` and
   `check (Node 26)` both pass.
3. After the user merges the PR, find the push run on `main` with
   `gh run list --branch main --event push --limit 1` and wait for it with `gh run watch <id>`.
   Passes when both jobs are green.

Each CI job uses a random seed. Pinning the seed would mean editing `ci.yml`, which is out of scope,
so T2 and T6 provide the coverage across seeds.

## Definition of done

- T1 was red before editing.
- T2–T10 pass in one session after the final edit.
- T11 passes as approved.
- The report lists every command that ran and its result, and names any step that was skipped.
