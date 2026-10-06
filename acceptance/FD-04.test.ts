import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { generatedTypesAreCurrent, readContract } from './support/contract.ts';
import { createDesk, type Desk } from './support/desk.ts';

// Monday 5 October 2026. New York is on EDT (UTC-4), so 13:00Z is 09:00 at
// the desk. A ticket that arrives then is due at 17:00 the same day.
const MONDAY_0900 = '2026-10-05T13:00:00Z';
const MONDAY_1000 = '2026-10-05T14:00:00Z';
const MONDAY_1100 = '2026-10-05T15:00:00Z';
const MONDAY_1200 = '2026-10-05T16:00:00Z';
const MONDAY_1300 = '2026-10-05T17:00:00Z';
const MONDAY_2300 = '2026-10-06T03:00:00Z';
const TUESDAY_0800 = '2026-10-06T12:00:00Z';
const TUESDAY_1000 = '2026-10-06T14:00:00Z';

interface Sla {
  dueAt: string;
  state: string;
  remainingMinutes: number | null;
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
async function newTicket(): Promise<number> {
  at(MONDAY_0900);
  counter += 1;
  return desk.receive({ from: `fd04-${counter}@example.com`, subject: `Order ${counter}` });
}

async function sla(id: number): Promise<Sla> {
  return ((await desk.get(`/api/tickets/${id}`).expect(200)).body as { sla: Sla }).sla;
}

async function setStatus(id: number, status: string): Promise<Sla> {
  return ((await desk.setStatus(id, status).expect(200)).body as { sla: Sla }).sla;
}

describe('FD-04: pending pauses the SLA clock', () => {
  it('stops counting down while the ticket is pending (1, 2)', async () => {
    const id = await newTicket();
    at(MONDAY_1000);
    expect(await sla(id)).toMatchObject({ state: 'on-track', remainingMinutes: 420 });

    expect(await setStatus(id, 'pending')).toMatchObject({
      state: 'paused',
      remainingMinutes: 420,
    });

    at(MONDAY_1200);
    expect(await sla(id)).toMatchObject({ state: 'paused', remainingMinutes: 420 });
    const pending = (await desk.get('/api/tickets?status=pending').expect(200)).body as Array<{
      id: number;
      sla: Sla;
    }>;
    expect(pending.find((t) => t.id === id)?.sla).toMatchObject({
      state: 'paused',
      remainingMinutes: 420,
    });
  });

  it('never breaches while pending (2)', async () => {
    const id = await newTicket();
    at(MONDAY_1000);
    await setStatus(id, 'pending');
    at(TUESDAY_1000);
    expect(await sla(id)).toMatchObject({ state: 'paused', remainingMinutes: 420 });
  });

  it('pushes the due time back by the business time spent pending (3)', async () => {
    const id = await newTicket();
    at(MONDAY_1000);
    const before = await sla(id);
    await setStatus(id, 'pending');

    at(MONDAY_1200);
    const resumed = await setStatus(id, 'open');
    expect(resumed).toMatchObject({ state: 'on-track', remainingMinutes: 420 });
    expect(new Date(resumed.dueAt).getTime()).toBeGreaterThan(new Date(before.dueAt).getTime());

    at(MONDAY_1300);
    expect(await sla(id)).toMatchObject({ state: 'on-track', remainingMinutes: 360 });
  });

  it('adds nothing for time pending outside business hours (3)', async () => {
    const id = await newTicket();
    at(MONDAY_2300);
    const before = await sla(id);
    await setStatus(id, 'pending');

    at(TUESDAY_0800);
    const resumed = await setStatus(id, 'open');
    expect(resumed.dueAt).toBe(before.dueAt);
  });

  it('adds up more than one pause (4)', async () => {
    const id = await newTicket();
    at(MONDAY_1000);
    await setStatus(id, 'pending');
    at(MONDAY_1100);
    await setStatus(id, 'open');
    at(MONDAY_1200);
    await setStatus(id, 'pending');
    at(MONDAY_1300);
    expect(await setStatus(id, 'open')).toMatchObject({ remainingMinutes: 360 });
  });

  it('shows a closed ticket as met on the very next read (5)', async () => {
    const id = await newTicket();
    at(MONDAY_1000);
    await desk.get('/api/tickets?status=open').expect(200);
    await sla(id);

    at(MONDAY_1100);
    expect(await setStatus(id, 'closed')).toMatchObject({ state: 'met', remainingMinutes: null });
    expect(await sla(id)).toMatchObject({ state: 'met', remainingMinutes: null });
  });

  it('counts down again after a closed ticket is reopened (5)', async () => {
    const id = await newTicket();
    at(MONDAY_1000);
    await setStatus(id, 'closed');
    await sla(id);

    at(MONDAY_1100);
    const reopened = await setStatus(id, 'open');
    expect(reopened.state).not.toBe('met');
    expect(reopened.remainingMinutes).not.toBeNull();
  });

  it('judges a pending ticket that is closed against the pushed-back due time (3, 5)', async () => {
    const id = await newTicket();
    at(MONDAY_1000);
    await setStatus(id, 'pending');
    // Pending all of Monday and Tuesday morning, then closed: past the original
    // 17:00 Monday due time, but the pause covers it.
    at(TUESDAY_1000);
    expect(await setStatus(id, 'closed')).toMatchObject({ state: 'met' });
  });

  it('adds the paused state to the contract and regenerates the types (7)', () => {
    expect(readContract()).toMatch(/enum: \[[^\]]*\bpaused\b[^\]]*\]/);
    expect(generatedTypesAreCurrent()).toBe(true);
  });
});
