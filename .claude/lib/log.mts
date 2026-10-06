/**
 * Output for the desk skills' scripts.
 *
 * People read these scripts in a terminal; Claude reads them through a skill.
 * DESK_LOG picks the shape:
 *
 *   text (default)  plain lines
 *   json            one JSON object per line: {"level":"warn","message":"..."}
 *
 * Text output is colored by level only when the stream is a terminal and
 * NO_COLOR is unset. Warnings and errors go to stderr.
 */
type Level = 'info' | 'warn' | 'error';

const COLORS: Record<Level, string> = { info: '', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

const json = process.env.DESK_LOG === 'json';

function write(level: Level, message: string): void {
  const stream = level === 'info' ? process.stdout : process.stderr;
  if (json) {
    stream.write(`${JSON.stringify({ level, message })}\n`);
    return;
  }
  const color = stream.isTTY && !process.env.NO_COLOR ? COLORS[level] : '';
  stream.write(color ? `${color}${message}${RESET}\n` : `${message}\n`);
}

export const log = {
  info: (message: string) => write('info', message),
  warn: (message: string) => write('warn', message),
  error: (message: string) => write('error', message),
};
