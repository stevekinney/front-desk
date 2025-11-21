import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

const schema = readFileSync(new URL('./db/schema.sql', import.meta.url), 'utf8');

/**
 * Open the API's own connection to the shared SQLite file and create the
 * tables the API owns. The mailroom keeps a separate connection.
 */
export function openDatabase(file: string): Database {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(schema);
  return db;
}

export function now(): string {
  return new Date().toISOString();
}
