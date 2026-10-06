import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { repositoryRoot } from './support/desk.ts';

interface Report {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: Array<{ name: string; assertionResults: Array<{ status: string }> }>;
}

const scratch = mkdtempSync(path.join(tmpdir(), 'front-desk-fd03-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Run the whole unit suite the way CI does and return Vitest's JSON report. */
function runSuite(seed: number | null): { status: number | null; report: Report } {
  const output = path.join(scratch, `report-${seed ?? 'default'}.json`);
  const order = seed === null ? [] : ['--sequence.shuffle', `--sequence.seed=${seed}`];
  const result = spawnSync(
    process.execPath,
    [
      path.join(repositoryRoot, 'node_modules/vitest/vitest.mjs'),
      'run',
      ...order,
      '--reporter=json',
      `--outputFile=${output}`,
    ],
    { cwd: repositoryRoot, stdio: 'ignore', env: { ...process.env, TZ: 'UTC' } },
  );
  return { status: result.status, report: JSON.parse(readFileSync(output, 'utf8')) as Report };
}

function testsIn(report: Report, file: string): Array<{ status: string }> {
  return report.testResults.find((r) => r.name.endsWith(file))?.assertionResults ?? [];
}

const ROUND_ROBIN = 'legacy/test/rules/assign-round-robin.test.js';

describe('FD-03: the suite passes in any order', () => {
  const baseline = runSuite(null);

  it('passes in the default order, with nothing skipped (1, 3)', () => {
    expect(baseline.report.numFailedTests).toBe(0);
    // Every test that exists ran and passed: none skipped.
    expect(baseline.report.numPassedTests).toBe(baseline.report.numTotalTests);
    expect(baseline.status).toBe(0);
  });

  it.each([2, 3, 5, 7, 9, 10, 11, 12, 15, 17])('passes when shuffled with seed %i (1)', (seed) => {
    const { status, report } = runSuite(seed);
    const failing = report.testResults
      .filter((r) => r.assertionResults.some((a) => a.status === 'failed'))
      .map((r) => path.relative(repositoryRoot, r.name));
    expect(failing).toEqual([]);
    expect(status).toBe(0);
  });

  it('keeps every round-robin test, all of them running (3)', () => {
    const tests = testsIn(baseline.report, ROUND_ROBIN);
    expect(tests.length).toBeGreaterThanOrEqual(6);
    expect(tests.every((t) => t.status === 'passed')).toBe(true);
  });

  it('keeps the rule matching its golden cases (4)', () => {
    const result = spawnSync(
      process.execPath,
      [
        path.join(repositoryRoot, 'node_modules/tsx/dist/cli.mjs'),
        'scripts/rules-parity.ts',
        'assign-round-robin',
      ],
      { cwd: repositoryRoot, stdio: 'ignore' },
    );
    expect(result.status).toBe(0);
  });

  it('no longer lists the round-robin test as a known failure (5)', () => {
    const known = readFileSync(path.join(repositoryRoot, 'KNOWN_FAILURES.md'), 'utf8');
    expect(known).not.toContain(ROUND_ROBIN);
  });
});
