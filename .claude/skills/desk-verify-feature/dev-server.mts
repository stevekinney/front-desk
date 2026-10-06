/**
 * Shared by dev-up.mts and dev-down.mts: where this checkout's dev server
 * listens, which checkout a listening process belongs to, and the record of a
 * server this skill started (so it stops only that one).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const root = realpathSync(path.resolve(import.meta.dirname, '../../..'));
export const apiPort = Number(process.env.PORT ?? 4100);
export const webPort = Number(process.env.WEB_PORT ?? 5173);

export interface StartedServer {
  pid: number;
  root: string;
  log: string;
  apiUrl: string;
  webUrl: string;
  startedAt: string;
}

const slug = `${path.basename(root)}-${apiPort}`;
const recordFile = path.join(os.tmpdir(), `front-desk-dev-${slug}.json`);
export const logFile = path.join(os.tmpdir(), `front-desk-dev-${slug}.log`);

export function readStarted(): StartedServer | null {
  if (!existsSync(recordFile)) return null;
  return JSON.parse(readFileSync(recordFile, 'utf8')) as StartedServer;
}

export function writeStarted(server: StartedServer): void {
  writeFileSync(recordFile, JSON.stringify(server, null, 2));
}

export function forgetStarted(): void {
  rmSync(recordFile, { force: true });
}

function lsof(args: string[]): string {
  try {
    return execFileSync('lsof', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

/** The pid listening on a TCP port, or null. */
export function listener(port: number): number | null {
  const pid = parseInt(
    lsof(['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).split('\n')[0] ?? '',
    10,
  );
  return Number.isNaN(pid) ? null : pid;
}

/** A process's working directory, or null when it can't be read. */
export function cwdOf(pid: number): string | null {
  const line = lsof(['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
    .split('\n')
    .find((l) => l.startsWith('n'));
  if (!line) return null;
  try {
    return realpathSync(line.slice(1));
  } catch {
    return line.slice(1);
  }
}

export async function responds(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}
