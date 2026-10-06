import { beforeAll, describe, expect, it } from 'vitest';

import { generatedTypesAreCurrent, readContract } from './support/contract.ts';
import { createDesk, type Desk } from './support/desk.ts';
import { deskDay, runNightlyExport } from './support/export.ts';

interface Ticket {
  id: number;
  priority: unknown;
  status: string;
}

let desk: Desk;

beforeAll(async () => {
  desk = await createDesk();
});

let counter = 0;
function newTicket(): Promise<number> {
  counter += 1;
  return desk.receive({ from: `fd06-${counter}@example.com`, subject: `Order ${counter}` });
}

async function ticket(id: number): Promise<Ticket> {
  return (await desk.get(`/api/tickets/${id}`).expect(200)).body as Ticket;
}

describe('FD-06: ticket priority', () => {
  it('gives new tickets normal priority (1, 2)', async () => {
    const id = await newTicket();
    expect((await ticket(id)).priority).toBe('normal');
    const list = (await desk.get('/api/tickets').expect(200)).body as Ticket[];
    expect(
      list.every((t) => ['low', 'normal', 'high', 'urgent'].includes(String(t.priority))),
    ).toBe(true);
  });

  it('changes priority and returns the updated ticket (3)', async () => {
    const id = await newTicket();
    for (const priority of ['low', 'high', 'urgent', 'normal']) {
      const res = await desk.patch(`/api/tickets/${id}/priority`, { priority }).expect(200);
      expect((res.body as Ticket).priority).toBe(priority);
      expect((await ticket(id)).priority).toBe(priority);
    }
  });

  it('rejects an unknown priority and an unknown ticket (3)', async () => {
    const id = await newTicket();
    await desk.patch(`/api/tickets/${id}/priority`, { priority: 'critical' }).expect(400);
    await desk.patch('/api/tickets/999999/priority', { priority: 'high' }).expect(404);
    expect((await ticket(id)).priority).toBe('normal');
  });

  it('filters the ticket list by priority (4)', async () => {
    const high = await newTicket();
    const low = await newTicket();
    await desk.patch(`/api/tickets/${high}/priority`, { priority: 'high' }).expect(200);
    await desk.patch(`/api/tickets/${low}/priority`, { priority: 'low' }).expect(200);
    const res = await desk.get('/api/tickets?priority=high').expect(200);
    const ids = (res.body as Ticket[]).map((t) => t.id);
    expect(ids).toContain(high);
    expect(ids).not.toContain(low);
    expect((res.body as Ticket[]).every((t) => t.priority === 'high')).toBe(true);
  });

  it('keeps priority through status changes (3)', async () => {
    const id = await newTicket();
    await desk.patch(`/api/tickets/${id}/priority`, { priority: 'urgent' }).expect(200);
    await desk.setStatus(id, 'pending').expect(200);
    await desk.setStatus(id, 'open').expect(200);
    expect((await ticket(id)).priority).toBe('urgent');
  });

  it('adds priority to the nightly export after the existing columns (6)', async () => {
    const urgent = await newTicket();
    const plain = await newTicket();
    await desk.patch(`/api/tickets/${urgent}/priority`, { priority: 'urgent' }).expect(200);
    await desk.setStatus(urgent, 'closed').expect(200);
    await desk.setStatus(plain, 'closed').expect(200);

    const csv = runNightlyExport(deskDay());
    expect(csv.header).toEqual([
      'ticket_id',
      'customer_email',
      'customer_name',
      'subject',
      'state',
      'opened_at',
      'resolved_at',
      'business_minutes',
      'priority',
    ]);
    const byId = new Map(csv.rows.map((row) => [Number(row.ticket_id), row]));
    expect(byId.get(urgent)).toMatchObject({ priority: 'urgent', state: 'resolved' });
    expect(byId.get(plain)).toMatchObject({ priority: 'normal', state: 'resolved' });
  });

  it('documents priority in the contract and regenerates the types (7)', () => {
    const contract = readContract();
    expect(contract).toMatch(/\/tickets\/\{ticketId\}\/priority:/);
    for (const value of ['low', 'normal', 'high', 'urgent']) {
      expect(contract).toMatch(new RegExp(`\\b${value}\\b`));
    }
    expect(generatedTypesAreCurrent()).toBe(true);
  });
});
