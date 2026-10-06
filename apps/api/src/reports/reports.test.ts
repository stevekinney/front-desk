import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { BusinessHours, SlaReportRow, TicketDetail } from '@front-desk/contract';

import { createTestDesk, type TestDesk } from '../../test/helpers.ts';
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
  vi.useRealTimers();
  await saveBusinessHours(defaults);
});

// Monday 2026-10-05 09:00 New York is 13:00Z.
async function receiveAt(iso: string, subject: string): Promise<number> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
  return desk.receive({ from: 'report@example.com', subject });
}

async function reportRow(ticketId: number): Promise<SlaReportRow | undefined> {
  const res = await request(desk.app).get('/api/reports/sla').expect(200);
  return (res.body as SlaReportRow[]).find((row) => row.ticketId === ticketId);
}

describe('GET /api/reports/sla', () => {
  it('counts business minutes until now for an open ticket', async () => {
    const id = await receiveAt('2026-10-05T13:00:00Z', 'Open one');
    vi.setSystemTime(new Date('2026-10-05T16:00:00Z'));
    expect(await reportRow(id)).toEqual({ ticketId: id, status: 'open', businessMinutes: 180 });
  });

  it('counts until the close for a closed ticket', async () => {
    const id = await receiveAt('2026-10-05T13:00:00Z', 'Closed one');
    vi.setSystemTime(new Date('2026-10-05T14:30:00Z'));
    await request(desk.app).patch(`/api/tickets/${id}/status`).send({ status: 'closed' });
    vi.setSystemTime(new Date('2026-10-06T14:30:00Z'));
    expect(await reportRow(id)).toMatchObject({ status: 'closed', businessMinutes: 90 });
  });

  it('follows the current settings', async () => {
    const id = await receiveAt('2026-10-05T13:00:00Z', 'Settings follow');
    vi.setSystemTime(new Date('2026-10-05T16:00:00Z'));
    await request(desk.app)
      .put('/api/settings/business-hours')
      .send({ ...defaults, openHour: 10 })
      .expect(200);
    expect(await reportRow(id)).toMatchObject({ businessMinutes: 120 });
  });

  it('moves a ticket that was already read to the new due time', async () => {
    const id = await receiveAt('2026-10-05T13:00:00Z', 'Already read');
    const before = await request(desk.app).get(`/api/tickets/${id}`).expect(200);
    expect((before.body as TicketDetail).sla.dueAt).toBe('2026-10-05T21:00:00.000Z');

    await request(desk.app)
      .put('/api/settings/business-hours')
      .send({ ...defaults, timeZone: 'Europe/London' })
      .expect(200);
    const after = await request(desk.app).get(`/api/tickets/${id}`).expect(200);
    // 13:00Z is 14:00 in London: three hours left on Monday, five on Tuesday.
    expect((after.body as TicketDetail).sla.dueAt).toBe('2026-10-06T13:00:00.000Z');
  });
});
