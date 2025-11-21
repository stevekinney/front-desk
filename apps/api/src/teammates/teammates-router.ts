import { Router } from 'express';

import type { Teammate } from '@front-desk/contract';

import type { Database } from '../database.ts';

export function teammatesRouter(db: Database): Router {
  const router = Router();

  router.get('/teammates', (_req, res) => {
    const teammates = db
      .prepare('SELECT id, name, email FROM teammates ORDER BY name')
      .all() as unknown as Teammate[];
    res.json(teammates.map(({ id, name, email }) => ({ id, name, email })));
  });

  return router;
}
