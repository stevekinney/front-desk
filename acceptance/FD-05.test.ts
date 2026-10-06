import { beforeAll, describe, expect, it } from 'vitest';

import { generatedTypesAreCurrent, readContract } from './support/contract.ts';
import { createDesk, type Desk } from './support/desk.ts';

interface Ticket {
  id: number;
  subject: string;
  status: string;
  assignee: unknown;
  customer: { id: number; email: string; name: string | null };
  messageCount: number;
  sla: { state: string; remainingMinutes: number | null };
}

interface Message {
  direction: string;
  fromEmail: string;
  fromName: string | null;
  body: string;
}

let desk: Desk;

beforeAll(async () => {
  desk = await createDesk();
});

const valid = {
  customerEmail: 'olivia@harborbakery.example',
  customerName: 'Olivia Chen',
  subject: 'Phone order: 500 loyalty cards',
  body: 'Called in to order 500 loyalty cards, same design as last spring.',
};

describe('FD-05: create a ticket', () => {
  it('creates an open, unassigned ticket and returns it (2, 3)', async () => {
    const res = await desk.post('/api/tickets', valid).expect(201);
    const ticket = res.body as Ticket;
    expect(ticket).toMatchObject({
      subject: valid.subject,
      status: 'open',
      assignee: null,
      messageCount: 1,
      customer: { email: valid.customerEmail, name: valid.customerName },
    });
    expect(ticket.sla.state).toBe('on-track');
    expect(ticket.sla.remainingMinutes).toBeGreaterThan(0);
  });

  it("records the message as the customer's first message (3)", async () => {
    const created = (await desk.post('/api/tickets', valid).expect(201)).body as Ticket;
    const detail = (await desk.get(`/api/tickets/${created.id}`).expect(200)).body as {
      messages: Message[];
    };
    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0]).toMatchObject({
      direction: 'inbound',
      fromEmail: valid.customerEmail,
      body: valid.body,
    });
  });

  it('shows up in the inbox like mail does (3)', async () => {
    const created = (await desk.post('/api/tickets', valid).expect(201)).body as Ticket;
    const open = (await desk.get('/api/tickets?status=open').expect(200)).body as Ticket[];
    expect(open.map((t) => t.id)).toContain(created.id);
  });

  it('works without a customer name (2)', async () => {
    const unnamed = {
      customerEmail: 'noname@example.com',
      subject: valid.subject,
      body: valid.body,
    };
    const res = await desk.post('/api/tickets', unnamed).expect(201);
    expect((res.body as Ticket).customer.email).toBe('noname@example.com');
  });

  it('files the ticket under an existing customer, ignoring case (4)', async () => {
    const mailed = await desk.receive({ from: 'kai@lumenstudio.example', subject: 'Hello' });
    const existing = (await desk.get(`/api/tickets/${mailed}`).expect(200)).body as Ticket;
    const created = (
      await desk
        .post('/api/tickets', { ...valid, customerEmail: 'Kai@LumenStudio.example' })
        .expect(201)
    ).body as Ticket;
    expect(created.customer.id).toBe(existing.customer.id);
  });

  it.each([
    ['a missing email', { ...valid, customerEmail: undefined }],
    ['an invalid email', { ...valid, customerEmail: 'not-an-email' }],
    ['a blank subject', { ...valid, subject: '   ' }],
    ['a blank message', { ...valid, body: '' }],
  ])('rejects %s with 400 and creates nothing (5)', async (_label, input) => {
    const before = ((await desk.get('/api/tickets').expect(200)).body as Ticket[]).length;
    await desk.post('/api/tickets', input).expect(400);
    const after = ((await desk.get('/api/tickets').expect(200)).body as Ticket[]).length;
    expect(after).toBe(before);
  });

  it('documents the operation in the contract and regenerates the types (6)', () => {
    const block = /\n {2}\/tickets:\n([\s\S]*?)\n {2}\/\S/.exec(readContract())?.[1] ?? '';
    expect(block).toMatch(/^ {4}post:/m);
    expect(generatedTypesAreCurrent()).toBe(true);
  });
});
