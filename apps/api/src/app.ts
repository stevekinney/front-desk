import express, { type Express } from 'express';

import { cannedRepliesRouter } from './canned-replies/canned-replies-router.ts';
import type { Database } from './database.ts';
import { errorHandler, unknownRoute } from './http.ts';
import { mailRouter } from './mail/mail-router.ts';
import { reportsRouter } from './reports/reports-router.ts';
import { settingsRouter } from './settings/settings-router.ts';
import { tagsRouter } from './tags/tags-router.ts';
import { teammatesRouter } from './teammates/teammates-router.ts';
import { ticketsRouter } from './tickets/tickets-router.ts';

export function createApp(db: Database): Express {
  const app = express();
  app.use(express.json());

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use(ticketsRouter(db));
  api.use(tagsRouter(db));
  api.use(cannedRepliesRouter(db));
  api.use(teammatesRouter(db));
  api.use(mailRouter(db));
  api.use(settingsRouter());
  api.use(reportsRouter());
  api.use(unknownRoute);

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
