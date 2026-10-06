import { Router } from 'express';

import type { BusinessHours } from '@front-desk/contract';

import { parse } from '../http.ts';
import { getBusinessHours, saveBusinessHours } from '../legacy-adapter.ts';
import { businessHoursSchema } from './settings-schemas.ts';

export function settingsRouter(): Router {
  const router = Router();

  router.get('/settings/business-hours', async (_req, res) => {
    res.json((await getBusinessHours()) satisfies BusinessHours);
  });

  router.put('/settings/business-hours', async (req, res) => {
    const settings = parse(businessHoursSchema, req.body);
    res.json((await saveBusinessHours(settings)) satisfies BusinessHours);
  });

  return router;
}
