import { promisify } from 'node:util';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { migrate, require } from './helpers.js';

const sla = require('../lib/sla');
const cache = require('../lib/cache');
const clock = require('../lib/clock');
const Customer = require('../models/customer');
const Ticket = require('../models/ticket');

const forTicket = promisify(sla.forTicket);
const updateStatus = promisify(Ticket.updateStatus);

// October 2026: New York is on EDT, UTC-4. Monday the 5th through Friday the 9th.
const at = (iso) => new Date(iso);

describe('businessMinutesBetween', () => {
  it('counts minutes inside one business day', () => {
    // 10:00 to 12:30 New York time.
    expect(sla.businessMinutesBetween(at('2026-10-05T14:00:00Z'), at('2026-10-05T16:30:00Z'))).toBe(
      150,
    );
  });

  it('ignores time before the desk opens', () => {
    // 07:00 to 10:00 New York time: only 09:00 to 10:00 counts.
    expect(sla.businessMinutesBetween(at('2026-10-05T11:00:00Z'), at('2026-10-05T14:00:00Z'))).toBe(
      60,
    );
  });

  it('skips the weekend', () => {
    // Saturday 12:00 to Monday 11:00 New York time.
    expect(sla.businessMinutesBetween(at('2026-10-10T16:00:00Z'), at('2026-10-12T15:00:00Z'))).toBe(
      120,
    );
  });

  it('is zero when the end is before the start', () => {
    expect(sla.businessMinutesBetween(at('2026-10-05T16:00:00Z'), at('2026-10-05T14:00:00Z'))).toBe(
      0,
    );
  });
});

describe('addBusinessMinutes', () => {
  it('stays on the same day when there is room', () => {
    expect(sla.addBusinessMinutes(at('2026-10-05T13:00:00Z'), 90).toISOString()).toBe(
      '2026-10-05T14:30:00.000Z',
    );
  });

  it('rolls an evening ticket to the next morning', () => {
    // Monday 20:00 New York, plus two business hours: Tuesday 11:00.
    expect(sla.addBusinessMinutes(at('2026-10-06T00:00:00Z'), 120).toISOString()).toBe(
      '2026-10-06T15:00:00.000Z',
    );
  });

  it('holds a weekend ticket until Monday', () => {
    // Saturday 11:00 New York, plus ninety business minutes: Monday 10:30.
    expect(sla.addBusinessMinutes(at('2026-10-10T15:00:00Z'), 90).toISOString()).toBe(
      '2026-10-12T14:30:00.000Z',
    );
  });
});

describe('summarize', () => {
  const snapshot = {
    ticketId: 1,
    status: 'open',
    // Tuesday 15:00 New York.
    dueAt: '2026-10-06T19:00:00.000Z',
    closedAt: null,
  };

  it('is on track with plenty of time left', () => {
    const summary = sla.summarize(snapshot, at('2026-10-06T13:30:00Z'));
    expect(summary.state).toBe('on-track');
    // Tuesday 09:30 to 15:00 New York.
    expect(summary.remainingMinutes).toBe(330);
  });

  it('is at risk inside the last two business hours', () => {
    expect(sla.summarize(snapshot, at('2026-10-06T17:30:00Z')).state).toBe('at-risk');
  });

  it('is breached after the due time', () => {
    const summary = sla.summarize(snapshot, at('2026-10-06T20:00:00Z'));
    expect(summary.state).toBe('breached');
    expect(summary.remainingMinutes).toBe(-60);
  });

  it('is met or missed once closed', () => {
    const closedEarly = { ...snapshot, status: 'closed', closedAt: '2026-10-06T18:00:00.000Z' };
    const closedLate = { ...snapshot, status: 'closed', closedAt: '2026-10-07T14:00:00.000Z' };
    expect(sla.summarize(closedEarly, at('2026-10-08T14:00:00Z')).state).toBe('met');
    expect(sla.summarize(closedLate, at('2026-10-08T14:00:00Z')).state).toBe('missed');
  });
});

describe('forTicket', () => {
  let customerId;

  beforeAll(async () => {
    await migrate();
    const customer = await promisify(Customer.create)({ email: 'sam@example.com', name: 'Sam' });
    customerId = customer.id;
  });

  afterEach(() => {
    clock.freeze(null);
  });

  // Arrives Monday 09:00 New York.
  async function openTicket() {
    clock.freeze(at('2026-10-05T13:00:00Z'));
    const ticket = await promisify(Ticket.create)({ subject: 'Hello', customer_id: customerId });
    return ticket.id;
  }

  it('is due eight business hours after the ticket arrives', async () => {
    const ticketId = await openTicket();
    clock.freeze(at('2026-10-05T14:00:00Z'));
    const summary = await forTicket(ticketId);
    // Monday 17:00 New York.
    expect(summary.dueAt).toBe('2026-10-05T21:00:00.000Z');
    expect(summary.state).toBe('on-track');
    expect(summary.remainingMinutes).toBe(420);
  });

  it('reflects a status change made through the model', async () => {
    const ticketId = await openTicket();
    clock.freeze(at('2026-10-05T16:00:00Z'));
    await forTicket(ticketId);
    expect(cache.get('sla:' + ticketId)).toBeDefined();

    await updateStatus(ticketId, 'closed');
    const summary = await forTicket(ticketId);
    expect(summary.state).toBe('met');
  });

  it('calls back with null for a missing ticket', async () => {
    expect(await forTicket(999999)).toBeNull();
  });
});
