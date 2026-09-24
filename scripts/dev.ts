/**
 * `npm run dev`: the API on :4100 (with the mailroom polling inbox/) and the
 * web app on :5173. Both run from the repository root, because the mailroom
 * resolves inbox/ and data/ against the working directory.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const bin = (name: string): string => path.join(root, 'node_modules', '.bin', name);

const processes: Array<{ name: string; child: ChildProcess }> = [
  {
    name: 'api',
    child: spawn(bin('tsx'), ['watch', '--clear-screen=false', 'apps/api/src/server.ts'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  },
  {
    name: 'web',
    child: spawn(bin('vite'), ['--config', 'apps/web/vite.config.ts'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  },
];

for (const { name, child } of processes) {
  const prefix = `[${name}] `;
  const forward = (stream: NodeJS.WriteStream) => (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) stream.write(prefix + line + '\n');
    }
  };
  child.stdout?.on('data', forward(process.stdout));
  child.stderr?.on('data', forward(process.stderr));
  child.on('exit', (code) => {
    if (stopping) return;
    console.log(`${prefix}exited with code ${code}`);
    stopAll(code ?? 1);
  });
}

let stopping = false;
function stopAll(code: number): void {
  if (stopping) return;
  stopping = true;
  for (const { child } of processes) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500).unref();
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
