import { setTimeout as sleep } from 'node:timers/promises';

import { Router } from 'express';
import { z } from 'zod';

import type { SimulatedMail } from '@front-desk/contract';

import type { Database } from '../database.ts';
import { HttpError, parse } from '../http.ts';
import { dropFixture, listFixtures, pollInbox } from '../legacy-adapter.ts';

const simulateSchema = z.object({
  fixture: z.string().trim().min(1).optional(),
});

/**
 * "Simulate incoming email" in the web app. It does what
 * `npm run mail:drop` does, then polls right away instead of waiting.
 */
export function mailRouter(db: Database): Router {
  const router = Router();

  router.get('/mail/fixtures', async (_req, res) => {
    res.json((await listFixtures()).map(stripExtension));
  });

  router.post('/mail/simulate', async (req, res) => {
    const { fixture } = parse(simulateSchema, req.body ?? {});
    const names = await listFixtures();
    const name = fixture ?? names[Math.floor(Math.random() * names.length)];
    if (!name) throw new HttpError(400, 'There are no fixtures to simulate');

    let filename: string;
    try {
      filename = await dropFixture(name);
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }

    const delivered = await waitForDelivery(db, filename);
    if (!delivered) throw new HttpError(500, `The mailroom did not ingest ${filename}`);
    res.status(201).json(delivered satisfies SimulatedMail);
  });

  return router;
}

function stripExtension(name: string): string {
  return name.replace(/\.(json|eml)$/i, '');
}

/**
 * The background poller may pick the file up before we do, so check the
 * mailroom's record of what it has seen rather than our own poll result.
 */
async function waitForDelivery(db: Database, filename: string): Promise<SimulatedMail | null> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await pollInbox();
    const row = db
      .prepare(
        `SELECT s.ticket_id,
                (SELECT count(*) FROM messages m WHERE m.ticket_id = s.ticket_id) AS message_count
           FROM mailroom_seen s WHERE s.filename = ?`,
      )
      .get(filename) as { ticket_id: number; message_count: number } | undefined;
    if (row) {
      return { filename, ticketId: row.ticket_id, created: row.message_count === 1 };
    }
    await sleep(100);
  }
  return null;
}
