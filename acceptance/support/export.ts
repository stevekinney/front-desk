import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { repositoryRoot } from './desk.ts';

/** Today's date at the support desk, as YYYY-MM-DD. */
export function deskDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Split one CSV line, honoring quoted fields. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      fields.push(field);
      field = '';
    } else field += ch;
  }
  fields.push(field);
  return fields;
}

export interface Csv {
  header: string[];
  rows: Array<Record<string, string>>;
}

/**
 * Run the nightly export for one day against the test database, the way cron
 * runs it, and read back the file it writes.
 */
export function runNightlyExport(day: string): Csv {
  const result = spawnSync(process.execPath, ['legacy/export/nightly-csv.js', day], {
    cwd: repositoryRoot,
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`nightly export exited with ${result.status}: ${result.stderr}`);
  }
  const file = path.join(process.env.FINANCE_EXPORT_DIR ?? '', `resolved-${day}.csv`);
  const lines = readFileSync(file, 'utf8').split('\r\n').filter(Boolean);
  const header = splitCsvLine(lines[0] ?? '');
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(header.map((name, i) => [name, values[i] ?? '']));
  });
  return { header, rows };
}
