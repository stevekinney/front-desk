import { Router } from 'express';

import type { SlaReportRow } from '@front-desk/contract';

import { getSlaReport } from '../legacy-adapter.ts';

export function reportsRouter(): Router {
  const router = Router();

  router.get('/reports/sla', async (_req, res) => {
    res.json((await getSlaReport()) satisfies SlaReportRow[]);
  });

  return router;
}
