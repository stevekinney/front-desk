import { DatabaseSync } from 'node:sqlite';

import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { BusinessHours } from '@front-desk/contract';

import { createTestDesk, type TestDesk } from '../../test/helpers.ts';
import { loadConfig } from '../config.ts';
import { saveBusinessHours } from '../legacy-adapter.ts';

const defaults: BusinessHours = {
  openHour: 9,
  closeHour: 17,
  timeZone: 'America/New_York',
  slaHours: 8,
};

let desk: TestDesk;

beforeAll(async () => {
  desk = await createTestDesk();
});

afterEach(async () => {
  await saveBusinessHours(defaults);
});

const get = () => request(desk.app).get('/api/settings/business-hours');
const put = (body: object) => request(desk.app).put('/api/settings/business-hours').send(body);

describe('business-hours settings', () => {
  it('starts with the defaults the desk uses today', async () => {
    const res = await get().expect(200);
    expect(res.body).toEqual(defaults);
  });

  it('saves valid settings and echoes them', async () => {
    const next = { openHour: 8, closeHour: 18, timeZone: 'Europe/London', slaHours: 4 };
    const saved = await put(next).expect(200);
    expect(saved.body).toEqual(next);
    expect((await get().expect(200)).body).toEqual(next);
  });

  it('accepts UTC and a zone with a half-hour offset', async () => {
    await put({ ...defaults, timeZone: 'UTC' }).expect(200);
    await put({ ...defaults, timeZone: 'Asia/Kolkata' }).expect(200);
  });

  it('keeps the saved settings in the database', async () => {
    const next = { openHour: 7, closeHour: 15, timeZone: 'UTC', slaHours: 2 };
    await put(next).expect(200);
    const db = new DatabaseSync(loadConfig().databasePath);
    try {
      expect(db.prepare('SELECT * FROM business_hours').all()).toEqual([
        { id: 1, open_hour: 7, close_hour: 15, time_zone: 'UTC', sla_hours: 2 },
      ]);
    } finally {
      db.close();
    }
  });

  const missingOpenHour = { closeHour: 17, timeZone: 'UTC', slaHours: 8 };
  const invalid: Array<[string, object]> = [
    ['a missing field', missingOpenHour],
    ['a fractional hour', { ...defaults, openHour: 9.5 }],
    ['an hour above 24', { ...defaults, closeHour: 25 }],
    ['a negative hour', { ...defaults, openHour: -1 }],
    ['opening after closing', { ...defaults, openHour: 17, closeHour: 9 }],
    ['opening when closing', { ...defaults, openHour: 9, closeHour: 9 }],
    ['an unknown zone', { ...defaults, timeZone: 'Mars/Olympus' }],
    ['a UTC offset', { ...defaults, timeZone: '+05:00' }],
    ['a zero SLA', { ...defaults, slaHours: 0 }],
    ['a fractional SLA', { ...defaults, slaHours: 1.5 }],
    ['an hour that is a string', { ...defaults, openHour: '9' }],
  ];

  it.each(invalid)('refuses %s and changes nothing', async (_name, body) => {
    await put(body).expect(400);
    expect((await get().expect(200)).body).toEqual(defaults);
  });
});
