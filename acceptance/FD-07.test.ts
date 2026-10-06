import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { generatedTypesAreCurrent, readContract } from './support/contract.ts';
import { createDesk, type Desk } from './support/desk.ts';

// Monday 5 October 2026. New York is on EDT (UTC-4); London is on BST (UTC+1).
const MONDAY_0900_NY = '2026-10-05T13:00:00Z';
const MONDAY_1000_NY = '2026-10-05T14:00:00Z';
const MONDAY_1100_NY = '2026-10-05T15:00:00Z';

const DEFAULTS = { openHour: 9, closeHour: 17, timeZone: 'America/New_York', slaHours: 8 };

interface Sla {
  dueAt: string;
}

let desk: Desk;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  desk = await createDesk();
});

afterAll(() => {
  vi.useRealTimers();
});

function at(iso: string): void {
  vi.setSystemTime(new Date(iso));
}

let counter = 0;
async function ticketAt(iso: string): Promise<number> {
  at(iso);
  counter += 1;
  return desk.receive({ from: `fd07-${counter}@example.com`, subject: `Order ${counter}` });
}

async function dueAt(id: number): Promise<string> {
  return ((await desk.get(`/api/tickets/${id}`).expect(200)).body as { sla: Sla }).sla.dueAt;
}

async function save(settings: object): Promise<void> {
  await desk.put('/api/settings/business-hours', settings).expect(200);
}

describe('FD-07: business-hours settings', () => {
  it('starts from the documented defaults (1)', async () => {
    const res = await desk.get('/api/settings/business-hours').expect(200);
    expect(res.body).toEqual(DEFAULTS);
  });

  it('counts a 9-to-17 day as eight business hours (4)', async () => {
    const id = await ticketAt(MONDAY_1000_NY);
    // Eight business hours after Monday 10:00 is Tuesday 10:00 in New York.
    expect(await dueAt(id)).toBe('2026-10-06T14:00:00.000Z');
  });

  it('saves settings and returns them (2)', async () => {
    const changed = { ...DEFAULTS, openHour: 8, closeHour: 16 };
    const res = await desk.put('/api/settings/business-hours', changed).expect(200);
    expect(res.body).toEqual(changed);
    expect((await desk.get('/api/settings/business-hours').expect(200)).body).toEqual(changed);
    await save(DEFAULTS);
  });

  it.each([
    ['opening at or after closing', { ...DEFAULTS, openHour: 17, closeHour: 9 }],
    ['an hour past 24', { ...DEFAULTS, closeHour: 25 }],
    ['a fractional hour', { ...DEFAULTS, openHour: 8.5 }],
    ['an unknown time zone', { ...DEFAULTS, timeZone: 'Mars/Olympus_Mons' }],
    ['zero SLA hours', { ...DEFAULTS, slaHours: 0 }],
    ['a missing field', { openHour: 9, closeHour: 17, timeZone: 'America/New_York' }],
  ])('rejects %s and keeps the old settings (2)', async (_label, settings) => {
    await desk.put('/api/settings/business-hours', settings).expect(400);
    expect((await desk.get('/api/settings/business-hours').expect(200)).body).toEqual(DEFAULTS);
  });

  it('moves due times as soon as the hours change, for tickets already read (3)', async () => {
    const id = await ticketAt(MONDAY_0900_NY);
    expect(await dueAt(id)).toBe('2026-10-05T21:00:00.000Z');

    await save({ ...DEFAULTS, closeHour: 13 });
    // Four hours on Monday (9 to 13) and four on Tuesday: Tuesday 13:00.
    expect(await dueAt(id)).toBe('2026-10-06T17:00:00.000Z');
    await save(DEFAULTS);
    expect(await dueAt(id)).toBe('2026-10-05T21:00:00.000Z');
  });

  it('uses the configured SLA length (3)', async () => {
    const id = await ticketAt(MONDAY_0900_NY);
    await save({ ...DEFAULTS, slaHours: 4 });
    expect(await dueAt(id)).toBe('2026-10-05T17:00:00.000Z');
    await save(DEFAULTS);
  });

  it('uses the configured time zone (3)', async () => {
    const id = await ticketAt(MONDAY_0900_NY);
    await save({ ...DEFAULTS, timeZone: 'Europe/London' });
    // 14:00 in London. Three hours on Monday, five on Tuesday: Tuesday 14:00 BST.
    expect(await dueAt(id)).toBe('2026-10-06T13:00:00.000Z');
    await save(DEFAULTS);
  });

  it('reports business minutes per ticket with the current settings (5)', async () => {
    const id = await ticketAt(MONDAY_0900_NY);
    at(MONDAY_1100_NY);
    await desk.setStatus(id, 'closed').expect(200);

    const row = async () => {
      const res = await desk.get('/api/reports/sla').expect(200);
      return (
        res.body as Array<{ ticketId: number; status: string; businessMinutes: number }>
      ).find((r) => r.ticketId === id);
    };
    expect(await row()).toEqual({ ticketId: id, status: 'closed', businessMinutes: 120 });

    await save({ ...DEFAULTS, openHour: 10 });
    expect((await row())?.businessMinutes).toBe(60);
    await save(DEFAULTS);
  });

  it('documents the new operations in the contract and regenerates the types (7)', () => {
    const contract = readContract();
    expect(contract).toMatch(/\/settings\/business-hours:/);
    expect(contract).toMatch(/\/reports\/sla:/);
    expect(generatedTypesAreCurrent()).toBe(true);
  });
});
