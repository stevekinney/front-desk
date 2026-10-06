import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { repositoryRoot } from './support/desk.ts';

const RULES = [
  'auto-close-stale',
  'escalate-vip',
  'tag-billing',
  'assign-round-robin',
  'reopen-on-reply',
];

const portPath = (name: string): string =>
  path.join(repositoryRoot, 'apps/api/src/rules', `${name}.ts`);

function parity(name: string): { status: number | null; output: string } {
  const result = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, 'node_modules/tsx/dist/cli.mjs'), 'scripts/rules-parity.ts', name],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('FD-08: the automation rules in TypeScript', () => {
  it.each(RULES)('has a TypeScript port of %s (1)', (name) => {
    expect(existsSync(portPath(name))).toBe(true);
  });

  it.each(RULES)('%s matches every golden case, in both versions (2, 4)', (name) => {
    const { status, output } = parity(name);
    const cases = (
      JSON.parse(
        readFileSync(path.join(repositoryRoot, 'fixtures/rules', `${name}.json`), 'utf8'),
      ) as { cases: unknown[] }
    ).cases.length;
    expect(output).toContain(`legacy     ${cases}/${cases} cases match`);
    expect(output).toContain(`typescript ${cases}/${cases} cases match`);
    expect(status).toBe(0);
  });

  it.each(RULES)('%s does not reach into legacy/ (3)', (name) => {
    const source = existsSync(portPath(name)) ? readFileSync(portPath(name), 'utf8') : '';
    expect(source).not.toBe('');
    expect(source).not.toMatch(
      /from\s+['"][^'"]*legacy|require\(\s*['"][^'"]*legacy|createRequire/,
    );
  });

  it('typechecks with the rest of the API (5)', () => {
    const result = spawnSync(
      process.execPath,
      [
        path.join(repositoryRoot, 'node_modules/typescript/bin/tsc'),
        '--noEmit',
        '-p',
        'apps/api/tsconfig.json',
      ],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    expect(result.stdout).toBe('');
    expect(result.status).toBe(0);
  });
});
