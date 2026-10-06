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

  it('does not count the 17:00 hour as business time', () => {
    // 16:00 to 18:00 New York time: only 16:00 to 17:00 counts.
    expect(sla.businessMinutesBetween(at('2026-10-05T20:00:00Z'), at('2026-10-05T22:00:00Z'))).toBe(
      60,
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
    pausedAt: null,
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

  it('freezes the remaining minutes while paused, however late it is read', () => {
    const paused = { ...snapshot, status: 'pending', pausedAt: '2026-10-06T13:30:00.000Z' };
    const early = sla.summarize(paused, at('2026-10-06T14:00:00Z'));
    const late = sla.summarize(paused, at('2026-10-20T14:00:00Z'));
    expect(early).toMatchObject({ state: 'paused', remainingMinutes: 330 });
    expect(late).toEqual(early);
  });

  it('keeps a negative frozen remainder when paused after the due time', () => {
    const paused = { ...snapshot, status: 'pending', pausedAt: '2026-10-06T20:00:00.000Z' };
    expect(sla.summarize(paused, at('2026-10-20T14:00:00Z'))).toMatchObject({
      state: 'paused',
      remainingMinutes: -60,
    });
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

  describe('pauses', () => {
    // Created Monday 09:00 New York; due Monday 17:00.
    async function pausedTicket(stretches) {
      const ticketId = await openTicket();
      for (const [from, to] of stretches) {
        clock.freeze(at(from));
        await updateStatus(ticketId, 'pending');
        if (to) {
          clock.freeze(at(to));
          await updateStatus(ticketId, 'open');
        }
      }
      return ticketId;
    }

    it('is paused with the remaining time frozen while pending', async () => {
      const ticketId = await pausedTicket([['2026-10-05T15:00:00Z']]);
      clock.freeze(at('2026-10-07T16:00:00Z'));
      const summary = await forTicket(ticketId);
      expect(summary.state).toBe('paused');
      // Monday 11:00 to 17:00 New York.
      expect(summary.remainingMinutes).toBe(360);
    });

    it('pushes the due time later by the business minutes spent pending', async () => {
      const ticketId = await pausedTicket([['2026-10-05T15:00:00Z', '2026-10-06T15:00:00Z']]);
      const summary = await forTicket(ticketId);
      // Monday 11:00 to Tuesday 11:00 is six plus two business hours.
      expect(summary.dueAt).toBe('2026-10-06T21:00:00.000Z');
      expect(summary.state).not.toBe('paused');
      expect(summary.remainingMinutes).toBe(360);
    });

    it('adds nothing for a pause outside business hours', async () => {
      clock.freeze(at('2026-10-05T17:00:00Z'));
      const ticket = await promisify(Ticket.create)({ subject: 'Late', customer_id: customerId });
      // Due Tuesday 13:00 New York.
      clock.freeze(at('2026-10-05T21:30:00Z'));
      await updateStatus(ticket.id, 'pending');
      clock.freeze(at('2026-10-06T12:00:00Z'));
      await updateStatus(ticket.id, 'open');
      expect((await forTicket(ticket.id)).dueAt).toBe('2026-10-06T17:00:00.000Z');
    });

    it('counts only the part of a pause that overlaps business hours', async () => {
      clock.freeze(at('2026-10-05T17:00:00Z'));
      const ticket = await promisify(Ticket.create)({ subject: 'Late', customer_id: customerId });
      // 16:30 to 18:30 pending on Monday is 30 business minutes, not 90.
      clock.freeze(at('2026-10-05T20:30:00Z'));
      await updateStatus(ticket.id, 'pending');
      clock.freeze(at('2026-10-06T12:30:00Z'));
      await updateStatus(ticket.id, 'open');
      expect((await forTicket(ticket.id)).dueAt).toBe('2026-10-06T17:30:00.000Z');
    });

    it('adds up several pauses', async () => {
      const ticketId = await pausedTicket([
        ['2026-10-05T14:00:00Z', '2026-10-05T15:00:00Z'],
        ['2026-10-05T17:00:00Z', '2026-10-05T18:30:00Z'],
      ]);
      expect((await forTicket(ticketId)).dueAt).toBe('2026-10-06T15:30:00.000Z');
    });

    it('is met when a pending ticket is closed in time', async () => {
      const ticketId = await pausedTicket([['2026-10-05T14:00:00Z']]);
      clock.freeze(at('2026-10-06T16:00:00Z'));
      await updateStatus(ticketId, 'closed');
      expect((await forTicket(ticketId)).state).toBe('met');
    });
  });

  it('calls back with null for a missing ticket', async () => {
    expect(await forTicket(999999)).toBeNull();
  });
});
