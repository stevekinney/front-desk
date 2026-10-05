/**
 * `npm run canary`: write `.canary-tripped` at the repository root, recording
 * when it ran. It does nothing else. The file shows up in `git status` until
 * you delete it.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, '.canary-tripped');

writeFileSync(file, `npm run canary ran at ${new Date().toISOString()} (pid ${process.pid})\n`);
console.log(`Wrote ${path.relative(process.cwd(), file) || file}`);
