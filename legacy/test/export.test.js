import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { migrate, require } from './helpers.js';

const clock = require('../lib/clock');
const Customer = require('../models/customer');
const Ticket = require('../models/ticket');
const script = path.resolve(import.meta.dirname, '../export/nightly-csv.js');

const create = (Model, attrs) => promisify(Model.create)(attrs);

beforeAll(async () => {
  await migrate();
});

afterEach(() => {
  clock.freeze(null);
});

describe('nightly CSV export', () => {
  it('keeps finance header and state values, and only exports closed tickets', async () => {
    clock.freeze(new Date('2026-10-05T13:00:00Z'));
    const customer = await create(Customer, { email: 'fin@example.com', name: 'Fin' });
    const closed = await create(Ticket, { subject: 'Done', customer_id: customer.id });
    await create(Ticket, { subject: 'Still open', customer_id: customer.id });
    const pending = await create(Ticket, { subject: 'Waiting', customer_id: customer.id });
    await promisify(Ticket.updateStatus)(pending.id, 'pending');
    clock.freeze(new Date('2026-10-05T15:00:00Z'));
    await promisify(Ticket.updateStatus)(closed.id, 'closed');

    // Run it as cron does: a separate process that reads the same environment.
    await promisify(execFile)(process.execPath, [script, '2026-10-05']);
    const file = path.join(process.env.FINANCE_EXPORT_DIR, 'resolved-2026-10-05.csv');

    const lines = fs.readFileSync(file, 'utf8').trim().split('\r\n');
    expect(lines[0]).toBe(
      'ticket_id,customer_email,customer_name,subject,state,opened_at,resolved_at,business_minutes',
    );
    expect(lines).toHaveLength(2);
    const fields = lines[1].split(',');
    expect(fields[0]).toBe(String(closed.id));
    expect(fields[4]).toBe('resolved');
  });
});
