/**
 * `npm run smoke`: run the unit tests the way CI does and compare the result
 * with KNOWN_FAILURES.md, so you know the baseline before you change anything.
 *
 *   npm run smoke                  TZ=UTC, shuffled with a random seed
 *   npm run smoke -- --seed 4242   replay one order
 *   npm run smoke -- --no-shuffle  default order
 *
 * Exits 0 when every failure is in a file KNOWN_FAILURES.md lists, and 1 when
 * anything else fails.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { parseTestOrder } from './test-order.ts';

interface Report {
  numTotalTests: number;
  numFailedTests: number;
  testResults: Array<{
    name: string;
    status: string;
    message?: string;
    assertionResults: Array<{ status: string; fullName: string }>;
  }>;
}

const root = path.resolve(import.meta.dirname, '..');

/** File paths in backticks at the start of each list item in KNOWN_FAILURES.md. */
function knownFailures(): Set<string> {
  const file = path.join(root, 'KNOWN_FAILURES.md');
  if (!existsSync(file)) return new Set();
  const known = new Set<string>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*[-*]\s+`([^`]+)`/.exec(line);
    if (match?.[1]) known.add(match[1]);
  }
  return known;
}

function checkNodeVersion(): void {
  const wanted = readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
  const running = process.versions.node;
  const parts = (version: string): number[] => version.replace(/^v/, '').split('.').map(Number);
  const [have, need] = [parts(running), parts(wanted)];
  const index = have.findIndex((n, i) => n !== need[i]);
  const tooOld = index !== -1 && (have[index] ?? 0) < (need[index] ?? 0);
  const note = tooOld ? `, older than the ${wanted} this project needs (see .nvmrc)` : '';
  console.log(`Node ${running}${note}`);
}

const order = parseTestOrder(process.argv.slice(2), { shuffleByDefault: true });
checkNodeVersion();
console.log('TZ=UTC');
console.log(order.describe());

// data/ is gitignored, so the report Vitest says it wrote is still there afterwards.
const reportFile = path.join(root, 'data', 'smoke-report.json');
mkdirSync(path.dirname(reportFile), { recursive: true });
rmSync(reportFile, { force: true });
const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    ...order.args,
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${reportFile}`,
  ],
  { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'UTC' } },
);
if (!existsSync(reportFile)) {
  console.error(`\nThe test run produced no report (exit ${result.status}).`);
  process.exit(1);
}
const report = JSON.parse(readFileSync(reportFile, 'utf8')) as Report;

const known = knownFailures();
const failing = report.testResults
  .filter((file) => file.status === 'failed')
  .map((file) => ({
    file: path.relative(root, file.name).split(path.sep).join('/'),
    tests: file.assertionResults.filter((t) => t.status === 'failed').length,
  }));
const expected = failing.filter((f) => known.has(f.file));
const unexpected = failing.filter((f) => !known.has(f.file));

console.log('\n── baseline ──');
console.log(order.describe());
console.log(
  `${report.numTotalTests - report.numFailedTests} of ${report.numTotalTests} tests passed`,
);
for (const f of expected) {
  console.log(`known  ${f.file} (${f.tests} failing), listed in KNOWN_FAILURES.md`);
}
for (const file of known) {
  if (!failing.some((f) => f.file === file)) {
    console.log(
      `known  ${file} passed in this order; it still fails in others (KNOWN_FAILURES.md)`,
    );
  }
}
for (const f of unexpected) console.log(`NEW    ${f.file} (${f.tests} failing)`);

if (unexpected.length > 0) {
  console.log('baseline: NOT green. The files marked NEW are not in KNOWN_FAILURES.md.');
  process.exit(1);
}
console.log('baseline: green except the items in KNOWN_FAILURES.md');
