import { writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Express } from 'express';

import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { openDatabase, type Database } from '../src/database.ts';
import { migrateLegacy, pollInbox } from '../src/legacy-adapter.ts';

export interface TestDesk {
  app: Express;
  db: Database;
  teammateId: number;
  /** Deliver an email to the inbox and ingest it. Resolves with the ticket id. */
  receive(mail: { from: string; subject: string; text?: string; name?: string }): Promise<number>;
}

let counter = 0;

export async function createTestDesk(): Promise<TestDesk> {
  const db = openDatabase(loadConfig().databasePath);
  await migrateLegacy();
  db.prepare(
    "INSERT OR IGNORE INTO teammates (name, email) VALUES ('Priya Raman', 'priya@frontdesk.example')",
  ).run();
  const { id: teammateId } = db
    .prepare("SELECT id FROM teammates WHERE email = 'priya@frontdesk.example'")
    .get() as { id: number };

  return {
    app: createApp(db),
    db,
    teammateId,
    async receive(mail) {
      counter += 1;
      const filename = `test-${String(counter).padStart(4, '0')}.json`;
      writeFileSync(
        path.join(process.env.MAILROOM_INBOX ?? '', filename),
        JSON.stringify({
          from: { name: mail.name ?? null, email: mail.from },
          subject: mail.subject,
          text: mail.text ?? 'Hello',
        }),
      );
      const deliveries = await pollInbox();
      const delivery = deliveries.find((d) => d.filename === filename);
      if (!delivery) throw new Error(`${filename} was not ingested`);
      return delivery.ticketId;
    },
  };
}
