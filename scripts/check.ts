/**
 * `npm run check`: everything CI checks, in one command.
 *
 *   npm run check                  default test order
 *   npm run check -- --seed 4242   shuffled test order, replayable from the seed
 *   TEST_SEED=4242 npm run check   the same, the way CI passes it
 *
 * Steps: lint, formatting, typecheck, generated-file drift, unit tests. Every
 * step runs even if an earlier one fails, and the summary lists each result.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parseTestOrder } from './test-order.ts';

const root = path.resolve(import.meta.dirname, '..');
const bin = (pkg: string, file: string): string => path.join(root, 'node_modules', pkg, file);

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): boolean {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32' && command === 'npm',
  });
  if (result.error) console.error(result.error.message);
  return result.status === 0;
}

/** Regenerate the contract types into a scratch file and compare. */
function generatedTypesMatch(): boolean {
  const contract = path.join(root, 'packages', 'contract');
  const committed = path.join(contract, 'src', 'generated', 'schema.d.ts');
  const dir = mkdtempSync(path.join(tmpdir(), 'front-desk-check-'));
  try {
    const output = path.join(dir, 'schema.d.ts');
    const generated = spawnSync(
      process.execPath,
      [bin('openapi-typescript', 'bin/cli.js'), 'openapi.yaml', '--output', output],
      { cwd: contract, stdio: ['ignore', 'ignore', 'inherit'] },
    );
    if (generated.status !== 0) return false;
    if (readFileSync(output, 'utf8') === readFileSync(committed, 'utf8')) {
      console.log('packages/contract/src/generated/schema.d.ts matches openapi.yaml');
      return true;
    }
    console.error(
      'packages/contract/src/generated/schema.d.ts does not match openapi.yaml. Run `npm run generate`.',
    );
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const order = parseTestOrder(process.argv.slice(2), { shuffleByDefault: false });

const steps: Array<{ name: string; run: () => boolean }> = [
  { name: 'lint', run: () => run(process.execPath, [bin('eslint', 'bin/eslint.js'), '.']) },
  {
    name: 'format',
    run: () => run(process.execPath, [bin('prettier', 'bin/prettier.cjs'), '--check', '.']),
  },
  { name: 'typecheck', run: () => run('npm', ['run', 'typecheck', '--silent']) },
  { name: 'generated files', run: generatedTypesMatch },
  {
    name: 'tests',
    run: () => {
      console.log(order.describe());
      return run(process.execPath, [bin('vitest', 'vitest.mjs'), 'run', ...order.args]);
    },
  },
];

const results: Array<[string, boolean]> = [];
for (const step of steps) {
  console.log(`\n── ${step.name} ──`);
  results.push([step.name, step.run()]);
}

console.log('\n── summary ──');
for (const [name, ok] of results) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
console.log(order.describe());
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
