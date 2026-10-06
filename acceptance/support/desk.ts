/**
 * A real Front Desk API on a throwaway database, for acceptance tests that
 * talk to it over HTTP. Responses are untyped on purpose: these tests describe
 * behavior the contract may not have yet.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '../../apps/api/src/app.ts';
import { loadConfig } from '../../apps/api/src/config.ts';
import { openDatabase, type Database } from '../../apps/api/src/database.ts';
import { migrateLegacy, pollInbox } from '../../apps/api/src/legacy-adapter.ts';

export const repositoryRoot = path.resolve(import.meta.dirname, '../..');

export interface Mail {
  from: string;
  subject: string;
  text?: string;
  name?: string;
  messageId?: string;
  inReplyTo?: string;
}

export interface Desk {
  app: Express;
  db: Database;
  /** The first teammate, Priya. */
  teammateId: number;
  /** Deliver an email and ingest it. Resolves with the ticket id. */
  receive(mail: Mail): Promise<number>;
  /** Put a file in the inbox as-is and ingest it. Resolves with the ticket id. */
  deliverFile(filename: string, contents: string | Buffer): Promise<number>;
  get(url: string): request.Test;
  post(url: string, body?: object): request.Test;
  put(url: string, body?: object): request.Test;
  patch(url: string, body?: object): request.Test;
  /** Tag a ticket by tag name, creating the tag if needed. */
  tag(ticketId: number, name: string): Promise<void>;
  setStatus(ticketId: number, status: string): request.Test;
}

let counter = 0;

export async function createDesk(): Promise<Desk> {
  const db = openDatabase(loadConfig().databasePath);
  await migrateLegacy();
  db.prepare(
    "INSERT OR IGNORE INTO teammates (name, email) VALUES ('Priya Raman', 'priya@frontdesk.example')",
  ).run();
  db.prepare(
    "INSERT OR IGNORE INTO teammates (name, email) VALUES ('Dana Whitfield', 'dana@frontdesk.example')",
  ).run();
  const { id: teammateId } = db
    .prepare("SELECT id FROM teammates WHERE email = 'priya@frontdesk.example'")
    .get() as { id: number };
  const app = createApp(db);

  async function deliverFile(filename: string, contents: string | Buffer): Promise<number> {
    writeFileSync(path.join(process.env.MAILROOM_INBOX ?? '', filename), contents);
    const deliveries = await pollInbox();
    const delivery = deliveries.find((d) => d.filename === filename);
    if (!delivery) throw new Error(`${filename} was not ingested`);
    return delivery.ticketId;
  }

  const desk: Desk = {
    app,
    db,
    teammateId,
    receive(mail) {
      counter += 1;
      return deliverFile(
        `acceptance-${String(counter).padStart(4, '0')}.json`,
        JSON.stringify({
          from: { name: mail.name ?? null, email: mail.from },
          subject: mail.subject,
          text: mail.text ?? 'Hello',
          messageId: mail.messageId,
          inReplyTo: mail.inReplyTo,
        }),
      );
    },
    deliverFile,
    get: (url) => request(app).get(url),
    post: (url, body) => request(app).post(url).send(body),
    put: (url, body) => request(app).put(url).send(body),
    patch: (url, body) => request(app).patch(url).send(body),
    async tag(ticketId, name) {
      const tags = (await request(app).get('/api/tags')).body as Array<{
        id: number;
        name: string;
      }>;
      let tag = tags.find((t) => t.name === name);
      if (!tag) {
        tag = (await request(app).post('/api/tags').send({ name, color: '#718096' })).body as {
          id: number;
          name: string;
        };
      }
      await request(app).put(`/api/tickets/${ticketId}/tags/${tag.id}`).expect(200);
    },
    setStatus: (ticketId, status) =>
      request(app).patch(`/api/tickets/${ticketId}/status`).send({ status }),
  };
  return desk;
}
