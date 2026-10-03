import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';

import { migrate, require } from './helpers.js';

const cache = require('../lib/cache');
const Customer = require('../models/customer');
const Ticket = require('../models/ticket');

const create = (Model, attrs) => promisify(Model.create)(attrs);

beforeAll(async () => {
  await migrate();
});

describe('defineModel', () => {
  it('inserts, finds, and updates a record', async () => {
    const customer = await create(Customer, { email: 'kim@example.com', name: 'Kim' });
    expect(customer.id).toBeGreaterThan(0);

    customer.name = 'Kim Lee';
    await promisify(customer.save.bind(customer))();

    const found = await promisify(Customer.find)(customer.id);
    expect(found.name).toBe('Kim Lee');
    expect(found.vip).toBe(0);
  });

  it('filters with where and findOne', async () => {
    await create(Customer, { email: 'vip@example.com', vip: 1 });
    const vips = await promisify(Customer.where)({ vip: 1 });
    expect(vips.map((c) => c.email)).toContain('vip@example.com');
    expect(await promisify(Customer.findOne)({ email: 'nobody@example.com' })).toBeNull();
  });

  it('refuses unknown columns', async () => {
    await expect(promisify(Customer.where)({ shoe_size: 9 })).rejects.toThrow(/Unknown column/);
  });

  it('finds or creates customers by email, case-insensitively', async () => {
    const first = await promisify(Customer.findOrCreate)({ email: 'Mo@Example.com', name: null });
    const second = await promisify(Customer.findOrCreate)({ email: 'mo@example.com', name: 'Mo' });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Mo');
  });
});

describe('Ticket', () => {
  it('stamps closed_at when closed and clears it when reopened', async () => {
    const customer = await create(Customer, { email: 'tix@example.com' });
    const ticket = await create(Ticket, { subject: 'Help', customer_id: customer.id });

    const closed = await promisify(Ticket.updateStatus)(ticket.id, 'closed');
    expect(closed.closed_at).not.toBeNull();

    const reopened = await promisify(Ticket.updateStatus)(ticket.id, 'open');
    expect(reopened.closed_at).toBeNull();
  });

  it('rejects an unknown status', async () => {
    await expect(promisify(Ticket.updateStatus)(1, 'archived')).rejects.toThrow(/Unknown status/);
  });

  it('drops the cached SLA summary when saved', async () => {
    const customer = await create(Customer, { email: 'cache@example.com' });
    const ticket = await create(Ticket, { subject: 'Cache', customer_id: customer.id });
    cache.set('sla:' + ticket.id, { stale: true });

    await promisify(ticket.save.bind(ticket))();

    expect(cache.get('sla:' + ticket.id)).toBeUndefined();
  });
});
