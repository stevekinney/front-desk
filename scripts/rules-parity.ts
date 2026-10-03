/**
 * `npm run rules:parity -- [name]`: check the automation rules against their
 * golden cases in fixtures/rules/<name>.json. With no name, checks all five.
 *
 * The mailroom's rule (legacy/rules/<name>.js) is always checked. If a
 * TypeScript version exists at apps/api/src/rules/<name>.ts, it is checked
 * against the same cases, so the two can't drift apart. A TypeScript rule
 * exports `rule` (or a default export) with the same shape as the mailroom's:
 * `{ name, when(ticket), run(ticket, ctx, cb?) }`. `run` may call `cb` or
 * return a promise. Every ctx method also takes an optional callback and
 * returns a promise.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';

type Done = (err?: Error | null) => void;

type Effect =
  | { type: 'setStatus'; status: string }
  | { type: 'assign'; teammateId: number }
  | { type: 'addTag'; tag: string };

interface RuleTicket {
  id: number;
  status: string;
  assignee_id: number | null;
  tags: string[];
  [key: string]: unknown;
}

interface Teammate {
  id: number;
  name: string;
  email: string;
}

interface Rule {
  name: string;
  when(ticket: RuleTicket): boolean | Promise<boolean>;
  run(ticket: RuleTicket, ctx: unknown, cb: Done): unknown;
}

interface GoldenCase {
  name: string;
  now?: string;
  teammates?: Teammate[];
  ticket: RuleTicket;
  expected: { when: boolean; effects: Effect[] };
}

interface Golden {
  rule: string;
  now: string;
  teammates: Teammate[];
  cases: GoldenCase[];
}

const root = path.resolve(import.meta.dirname, '..');
const fixturesDir = path.join(root, 'fixtures', 'rules');
const require = createRequire(import.meta.url);

function settle(done: Done | undefined): Promise<void> {
  if (done) setImmediate(done, null);
  return Promise.resolve();
}

function recordingContext(now: string, teammates: Teammate[], ticket: RuleTicket) {
  const effects: Effect[] = [];
  const ctx = {
    now: new Date(now),
    teammates,
    setStatus(status: string, done?: Done) {
      effects.push({ type: 'setStatus', status });
      ticket.status = status;
      return settle(done);
    },
    assign(teammateId: number, done?: Done) {
      effects.push({ type: 'assign', teammateId });
      ticket.assignee_id = teammateId;
      return settle(done);
    },
    addTag(tag: string, done?: Done) {
      effects.push({ type: 'addTag', tag });
      if (!ticket.tags.includes(tag)) ticket.tags.push(tag);
      return settle(done);
    },
    log() {},
  };
  return { ctx, effects };
}

function runRule(rule: Rule, ticket: RuleTicket, ctx: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const done: Done = (err) => {
      if (finished) return;
      finished = true;
      if (err) reject(err);
      else resolve();
    };
    try {
      const result = rule.run(ticket, ctx, done);
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).then(() => done(null), done);
      }
    } catch (err) {
      done(err as Error);
    }
  });
}

async function check(rule: Rule, golden: Golden): Promise<string[]> {
  const failures: string[] = [];
  for (const goldenCase of golden.cases) {
    const ticket = structuredClone(goldenCase.ticket);
    const { ctx, effects } = recordingContext(
      goldenCase.now ?? golden.now,
      goldenCase.teammates ?? golden.teammates,
      ticket,
    );
    try {
      const when = Boolean(await rule.when(ticket));
      if (when) await runRule(rule, ticket, ctx);
      const actual = { when, effects };
      if (!isDeepStrictEqual(actual, goldenCase.expected)) {
        failures.push(
          `${goldenCase.name}\n      expected ${JSON.stringify(goldenCase.expected)}\n      actual   ${JSON.stringify(actual)}`,
        );
      }
    } catch (err) {
      failures.push(`${goldenCase.name}\n      threw ${(err as Error).message}`);
    }
  }
  return failures;
}

async function loadTypeScriptRule(name: string): Promise<Rule | null> {
  const file = path.join(root, 'apps', 'api', 'src', 'rules', `${name}.ts`);
  if (!existsSync(file)) return null;
  const mod = (await import(pathToFileURL(file).href)) as { rule?: Rule; default?: Rule };
  const rule = mod.rule ?? mod.default;
  if (!rule) throw new Error(`${path.relative(root, file)} exports neither \`rule\` nor a default`);
  return rule;
}

const available = readdirSync(fixturesDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
for (const name of requested) {
  if (!available.includes(name)) {
    console.error(`No golden cases for "${name}". Rules: ${available.join(', ')}`);
    process.exit(2);
  }
}

let failed = false;
for (const name of requested.length ? requested : available) {
  const golden = JSON.parse(readFileSync(path.join(fixturesDir, `${name}.json`), 'utf8')) as Golden;
  const implementations: Array<[string, Rule | null]> = [
    ['legacy', require(path.join(root, 'legacy', 'rules', `${name}.js`)) as Rule],
    ['typescript', await loadTypeScriptRule(name)],
  ];
  console.log(name);
  for (const [label, rule] of implementations) {
    if (!rule) {
      console.log(`  ${label.padEnd(10)} not written yet`);
      continue;
    }
    const failures = await check(rule, golden);
    const passed = golden.cases.length - failures.length;
    console.log(`  ${label.padEnd(10)} ${passed}/${golden.cases.length} cases match`);
    for (const failure of failures) console.log(`    ✗ ${failure}`);
    if (failures.length) failed = true;
  }
}

process.exit(failed ? 1 : 0);
