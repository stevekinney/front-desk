import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { repositoryRoot } from './desk.ts';

const contractDir = path.join(repositoryRoot, 'packages/contract');

/** The hand-written OpenAPI document. */
export function readContract(): string {
  return readFileSync(path.join(contractDir, 'openapi.yaml'), 'utf8');
}

/**
 * Regenerate the types into a scratch file and compare them with the
 * committed ones. Returns true when they match byte for byte.
 */
export function generatedTypesAreCurrent(): boolean {
  const dir = mkdtempSync(path.join(tmpdir(), 'front-desk-contract-'));
  try {
    const output = path.join(dir, 'schema.d.ts');
    const result = spawnSync(
      process.execPath,
      [
        path.join(repositoryRoot, 'node_modules/openapi-typescript/bin/cli.js'),
        'openapi.yaml',
        '--output',
        output,
      ],
      { cwd: contractDir, stdio: 'ignore' },
    );
    if (result.status !== 0) return false;
    const committed = readFileSync(path.join(contractDir, 'src/generated/schema.d.ts'), 'utf8');
    return readFileSync(output, 'utf8') === committed;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
