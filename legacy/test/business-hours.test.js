import { promisify } from 'node:util';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { migrate, require } from './helpers.js';

const sla = require('../lib/sla');
const businessHours = require('../lib/business-hours');
const cache = require('../lib/cache');
const clock = require('../lib/clock');
const Customer = require('../models/customer');
const Ticket = require('../models/ticket');

const save = promisify(businessHours.save);
const load = promisify(businessHours.load);
const forTicket = promisify(sla.forTicket);
const report = promisify(sla.report);

const at = (iso) => new Date(iso);
const defaults = { openHour: 9, closeHour: 17, timeZone: 'America/New_York', slaHours: 8 };

beforeAll(async () => {
  await migrate();
});

afterEach(async () => {
  clock.freeze(null);
  await save(defaults);
  businessHours.reset();
});

describe('business hours', () => {
  it('start as the defaults the desk has always used', async () => {
    expect(await load()).toEqual(defaults);
    expect(businessHours.get()).toEqual(defaults);
  });

  it('survive a restart', async () => {
    const next = { openHour: 8, closeHour: 18, timeZone: 'Europe/London', slaHours: 4 };
    await save(next);
    businessHours.reset();
    expect(businessHours.isLoaded()).toBe(false);
    expect(await load()).toEqual(next);
    expect(businessHours.get()).toEqual(next);
  });

  it('drop every cached SLA when saved', async () => {
    cache.set('sla:1', { stale: true });
    cache.set('other:1', { keep: true });
    await save(defaults);
    expect(cache.get('sla:1')).toBeUndefined();
    expect(cache.get('other:1')).toEqual({ keep: true });
    cache.del('other:1');
  });
});

describe('the SLA clock under custom settings', () => {
  it('treats the closing hour as closed', () => {
    // 16:00 to 18:00 New York time.
    expect(sla.businessMinutesBetween(at('2026-10-05T20:00:00Z'), at('2026-10-05T22:00:00Z'))).toBe(
      60,
    );
    // 16:30 New York, 60 business minutes later: 09:30 the next day.
    expect(sla.addBusinessMinutes(at('2026-10-05T20:30:00Z'), 60).toISOString()).toBe(
      '2026-10-06T13:30:00.000Z',
    );
  });

  it('follows the opening hour', async () => {
    await save({ ...defaults, openHour: 10 });
    // 09:00 to 12:00 New York time: only 10:00 to 12:00 counts.
    expect(sla.businessMinutesBetween(at('2026-10-05T13:00:00Z'), at('2026-10-05T16:00:00Z'))).toBe(
      120,
    );
  });

  it('closes on time in a zone with a half-hour offset', async () => {
    await save({ ...defaults, timeZone: 'Asia/Kolkata' });
    // 09:00 to 17:30 IST on a Monday: the day ends at 17:00, so 480 minutes.
    expect(sla.businessMinutesBetween(at('2026-10-05T03:30:00Z'), at('2026-10-05T12:00:00Z'))).toBe(
      480,
    );
  });

  it('gives an already-read ticket its new due time', async () => {
    const customer = await promisify(Customer.create)({ email: 'amy@example.com', name: 'Amy' });
    clock.freeze(at('2026-10-05T13:00:00Z'));
    const ticket = await promisify(Ticket.create)({ subject: 'Hi', customer_id: customer.id });

    expect((await forTicket(ticket.id)).dueAt).toBe('2026-10-05T21:00:00.000Z');
    await save({ ...defaults, timeZone: 'Europe/London' });
    expect((await forTicket(ticket.id)).dueAt).toBe('2026-10-06T13:00:00.000Z');
  });

  it('uses the saved SLA length', async () => {
    const customer = await promisify(Customer.create)({ email: 'bo@example.com', name: 'Bo' });
    clock.freeze(at('2026-10-05T13:00:00Z'));
    const ticket = await promisify(Ticket.create)({ subject: 'Hi', customer_id: customer.id });
    await save({ ...defaults, slaHours: 2 });
    expect((await forTicket(ticket.id)).dueAt).toBe('2026-10-05T15:00:00.000Z');
  });
});

describe('report', () => {
  it('counts business minutes to the close, or to now when still open', async () => {
    const customer = await promisify(Customer.create)({ email: 'cy@example.com', name: 'Cy' });
    clock.freeze(at('2026-10-05T13:00:00Z'));
    const open = await promisify(Ticket.create)({ subject: 'Open', customer_id: customer.id });
    const closed = await promisify(Ticket.create)({ subject: 'Closed', customer_id: customer.id });
    clock.freeze(at('2026-10-05T14:30:00Z'));
    await promisify(Ticket.updateStatus)(closed.id, 'closed');
    clock.freeze(at('2026-10-05T16:00:00Z'));

    const rows = await report();
    expect(rows.find((row) => row.ticketId === open.id)).toEqual({
      ticketId: open.id,
      status: 'open',
      businessMinutes: 180,
    });
    expect(rows.find((row) => row.ticketId === closed.id)).toMatchObject({
      status: 'closed',
      businessMinutes: 90,
    });
  });
});
