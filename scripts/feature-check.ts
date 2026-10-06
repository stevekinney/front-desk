/**
 * `npm run feature:check -- <id>`: run a backlog item's acceptance tests and
 * record the result in features.json.
 *
 *   npm run feature:check -- FD-01
 *   npm run feature:check -- --all
 *
 * This is the only thing that writes `passes`. It sets it to true when every
 * acceptance file for the feature passes and to false otherwise, so a feature
 * that regresses goes back to false. Nothing else is changed in the file.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface Feature {
  id: string;
  title: string;
  acceptance: string[];
  passes: boolean;
  [key: string]: unknown;
}

const root = path.resolve(import.meta.dirname, '..');
const featuresFile = path.join(root, 'features.json');
const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');

function readFeatures(): Feature[] {
  return JSON.parse(readFileSync(featuresFile, 'utf8')) as Feature[];
}

function writeFeatures(features: Feature[]): void {
  writeFileSync(featuresFile, `${JSON.stringify(features, null, 2)}\n`);
}

function usage(features: Feature[]): never {
  console.error('usage: npm run feature:check -- <id> | --all');
  console.error(`ids: ${features.map((f) => f.id).join(', ')}`);
  process.exit(2);
}

/** Run one feature's acceptance files. Output goes straight to the terminal. */
function runAcceptance(feature: Feature): boolean {
  const missing = feature.acceptance.filter((file) => !existsSync(path.join(root, file)));
  if (missing.length > 0) {
    console.error(`${feature.id}: missing acceptance files: ${missing.join(', ')}`);
    return false;
  }
  console.log(`\n${feature.id}: ${feature.title}`);
  const result = spawnSync(
    process.execPath,
    [vitest, 'run', '--config', 'acceptance/vitest.config.ts', ...feature.acceptance],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.error) {
    console.error(`${feature.id}: could not run vitest: ${result.error.message}`);
    return false;
  }
  return result.status === 0;
}

const features = readFeatures();
const arg = process.argv[2];
if (!arg) usage(features);

const selected =
  arg === '--all' ? features : features.filter((f) => f.id.toLowerCase() === arg.toLowerCase());
if (selected.length === 0) {
  console.error(`Unknown feature "${arg}".`);
  usage(features);
}

const results = new Map<string, boolean>();
for (const feature of selected) results.set(feature.id, runAcceptance(feature));

// Re-read, so a long --all run doesn't overwrite edits made in the meantime.
const latest = readFeatures();
for (const feature of latest) {
  const passed = results.get(feature.id);
  if (passed !== undefined) feature.passes = passed;
}
writeFeatures(latest);

console.log('');
for (const [id, passed] of results) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${id}  (features.json: passes = ${passed})`);
}
process.exit([...results.values()].every(Boolean) ? 0 : 1);
