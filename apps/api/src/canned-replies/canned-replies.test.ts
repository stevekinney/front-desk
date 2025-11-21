import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import type { CannedReply, Message } from '@front-desk/contract';

import { createTestDesk, type TestDesk } from '../../test/helpers.ts';
import { renderCannedReply } from './render-canned-reply.ts';

let desk: TestDesk;

beforeAll(async () => {
  desk = await createTestDesk();
});

describe('renderCannedReply', () => {
  const context = { customerName: 'Ada Lovelace', ticketId: 7, teammateName: 'Priya Raman' };

  it('fills in the placeholders', () => {
    expect(
      renderCannedReply('Hi {{customer.name}}, re #{{ ticket.id }}. {{teammate.name}}', context),
    ).toBe('Hi Ada, re #7. Priya Raman');
  });

  it('falls back when the customer has no name', () => {
    expect(renderCannedReply('Hi {{customer.name}}', { ...context, customerName: null })).toBe(
      'Hi there',
    );
  });

  it('leaves unknown placeholders alone', () => {
    expect(renderCannedReply('Order {{order.id}}', context)).toBe('Order {{order.id}}');
  });
});

describe('canned replies', () => {
  it('creates and lists canned replies', async () => {
    const created = await request(desk.app)
      .post('/api/canned-replies')
      .send({ title: 'Thanks', body: 'Thanks, {{customer.name}}!' })
      .expect(201);

    const res = await request(desk.app).get('/api/canned-replies').expect(200);
    expect(res.body as CannedReply[]).toContainEqual(created.body);
  });

  it('validates input', async () => {
    await request(desk.app).post('/api/canned-replies').send({ title: '', body: 'x' }).expect(400);
  });

  it('sends a filled-in reply through the outbox', async () => {
    const { body: template } = await request(desk.app)
      .post('/api/canned-replies')
      .send({ title: 'Order number', body: 'Hi {{customer.name}}, what is your order number?' });
    const ticketId = await desk.receive({
      from: 'pat@example.com',
      name: 'Pat Doe',
      subject: 'Late',
    });

    const res = await request(desk.app)
      .post(`/api/tickets/${ticketId}/canned-replies/${template.id}`)
      .send({ teammateId: desk.teammateId })
      .expect(201);

    expect(res.body as Message).toMatchObject({
      direction: 'outbound',
      body: 'Hi Pat, what is your order number?',
      delivery: { to: 'pat@example.com' },
    });
  });

  it('404s for a missing template or ticket', async () => {
    const { body: template } = await request(desk.app)
      .post('/api/canned-replies')
      .send({ title: 'Any', body: 'Hello' });
    const ticketId = await desk.receive({ from: 'quinn@example.com', subject: 'Hi' });

    await request(desk.app)
      .post(`/api/tickets/${ticketId}/canned-replies/999999`)
      .send({ teammateId: desk.teammateId })
      .expect(404);
    await request(desk.app)
      .post(`/api/tickets/999999/canned-replies/${template.id}`)
      .send({ teammateId: desk.teammateId })
      .expect(404);
  });
});
