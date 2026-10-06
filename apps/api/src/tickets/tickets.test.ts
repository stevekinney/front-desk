import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Message, Ticket, TicketDetail } from '@front-desk/contract';

import { createTestDesk, type TestDesk } from '../../test/helpers.ts';

let desk: TestDesk;

beforeAll(async () => {
  desk = await createTestDesk();
});

describe('GET /api/tickets', () => {
  it('lists tickets with their customer and SLA', async () => {
    const id = await desk.receive({ from: 'ana@example.com', name: 'Ana', subject: 'Lost order' });

    const res = await request(desk.app).get('/api/tickets').expect(200);
    const ticket = (res.body as Ticket[]).find((t) => t.id === id);

    expect(ticket).toMatchObject({
      subject: 'Lost order',
      status: 'open',
      customer: { name: 'Ana', email: 'ana@example.com', vip: false },
      assignee: null,
      tags: [],
      messageCount: 1,
      closedAt: null,
    });
    expect(ticket?.sla.state).toMatch(/on-track|at-risk/);
    expect(ticket?.sla.remainingMinutes).toBeGreaterThan(0);
  });

  it('filters by status', async () => {
    const id = await desk.receive({ from: 'ben@example.com', subject: 'Done already' });
    await request(desk.app)
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'closed' })
      .expect(200);

    const res = await request(desk.app).get('/api/tickets?status=closed').expect(200);

    expect((res.body as Ticket[]).map((t) => t.id)).toContain(id);
    expect((res.body as Ticket[]).every((t) => t.status === 'closed')).toBe(true);
  });

  it('rejects an unknown status filter', async () => {
    const res = await request(desk.app).get('/api/tickets?status=archived').expect(400);
    expect(res.body.issues[0].path).toBe('status');
  });
});

describe('GET /api/tickets/:id', () => {
  it('includes the messages', async () => {
    const id = await desk.receive({ from: 'cy@example.com', subject: 'Help', text: 'Please help' });

    const res = await request(desk.app).get(`/api/tickets/${id}`).expect(200);
    const detail = res.body as TicketDetail;

    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0]).toMatchObject({
      direction: 'inbound',
      fromEmail: 'cy@example.com',
      body: 'Please help',
      delivery: null,
    });
  });

  it('404s for a missing ticket', async () => {
    await request(desk.app).get('/api/tickets/999999').expect(404);
  });

  it('400s for a non-numeric id', async () => {
    await request(desk.app).get('/api/tickets/abc').expect(400);
  });
});

describe('PATCH /api/tickets/:id/status', () => {
  it('closes a ticket and marks the SLA met', async () => {
    const id = await desk.receive({ from: 'dee@example.com', subject: 'Quick one' });

    const res = await request(desk.app)
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'closed' })
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'closed',
      sla: { state: 'met', remainingMinutes: null },
    });
    expect(res.body.closedAt).not.toBeNull();
  });

  it('reopens a closed ticket', async () => {
    const id = await desk.receive({ from: 'eli@example.com', subject: 'Not done' });
    await request(desk.app).patch(`/api/tickets/${id}/status`).send({ status: 'closed' });

    const res = await request(desk.app)
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'open' })
      .expect(200);

    expect(res.body).toMatchObject({ status: 'open', closedAt: null });
  });

  it('rejects an unknown status', async () => {
    const id = await desk.receive({ from: 'fay@example.com', subject: 'Status' });
    await request(desk.app).patch(`/api/tickets/${id}/status`).send({ status: 'done' }).expect(400);
  });
});

describe('status without a state column', () => {
  it('has no tickets.state column and still moves through every status', async () => {
    expect(
      desk.db.prepare("SELECT 1 FROM pragma_table_info('tickets') WHERE name = 'state'").get(),
    ).toBeUndefined();

    const id = await desk.receive({ from: 'cycle@example.com', subject: 'Cycle' });
    for (const status of ['pending', 'closed', 'open'] as const) {
      const res = await request(desk.app)
        .patch(`/api/tickets/${id}/status`)
        .send({ status })
        .expect(200);
      expect((res.body as Ticket).status).toBe(status);
      expect((res.body as Ticket).closedAt === null).toBe(status !== 'closed');
    }
  });
});

describe('PUT /api/tickets/:id/assignee', () => {
  it('assigns and unassigns', async () => {
    const id = await desk.receive({ from: 'gus@example.com', subject: 'Assign me' });

    const assigned = await request(desk.app)
      .put(`/api/tickets/${id}/assignee`)
      .send({ teammateId: desk.teammateId })
      .expect(200);
    expect(assigned.body.assignee).toMatchObject({ id: desk.teammateId, name: 'Priya Raman' });

    const unassigned = await request(desk.app)
      .put(`/api/tickets/${id}/assignee`)
      .send({ teammateId: null })
      .expect(200);
    expect(unassigned.body.assignee).toBeNull();
  });

  it('filters the list by assignee', async () => {
    const id = await desk.receive({ from: 'hal@example.com', subject: 'Mine' });
    await request(desk.app)
      .put(`/api/tickets/${id}/assignee`)
      .send({ teammateId: desk.teammateId });

    const res = await request(desk.app)
      .get(`/api/tickets?assigneeId=${desk.teammateId}`)
      .expect(200);

    expect((res.body as Ticket[]).map((t) => t.id)).toContain(id);
  });

  it('rejects an unknown teammate', async () => {
    const id = await desk.receive({ from: 'ida@example.com', subject: 'Nobody' });
    await request(desk.app)
      .put(`/api/tickets/${id}/assignee`)
      .send({ teammateId: 9999 })
      .expect(400);
  });
});

describe('POST /api/tickets/:id/replies', () => {
  it('records the reply and queues it in the outbox', async () => {
    const id = await desk.receive({ from: 'jan@example.com', subject: 'Order status' });

    const res = await request(desk.app)
      .post(`/api/tickets/${id}/replies`)
      .send({ teammateId: desk.teammateId, body: 'It ships tomorrow.' })
      .expect(201);
    const message = res.body as Message;

    expect(message).toMatchObject({
      direction: 'outbound',
      author: { id: desk.teammateId },
      body: 'It ships tomorrow.',
      delivery: { to: 'jan@example.com', subject: `Re: Order status [#${id}]` },
    });
    const outbox = desk.db.prepare('SELECT count(*) AS n FROM outbox WHERE ticket_id = ?').get(id);
    expect(outbox).toEqual({ n: 1 });
  });

  it('rejects an empty reply', async () => {
    const id = await desk.receive({ from: 'kai@example.com', subject: 'Empty' });
    await request(desk.app)
      .post(`/api/tickets/${id}/replies`)
      .send({ teammateId: desk.teammateId, body: '   ' })
      .expect(400);
  });

  it('404s for a missing ticket', async () => {
    await request(desk.app)
      .post('/api/tickets/999999/replies')
      .send({ teammateId: desk.teammateId, body: 'Hello?' })
      .expect(404);
  });
});

describe('SLA and pending', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const freeze = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };
  const patch = (id: number, status: string) =>
    request(desk.app).patch(`/api/tickets/${id}/status`).send({ status }).expect(200);

  it('shows paused on the very next read after a cached read', async () => {
    freeze('2026-10-05T13:00:00Z');
    const id = await desk.receive({ from: 'pa@example.com', subject: 'Pause me' });
    freeze('2026-10-05T15:00:00Z');
    await request(desk.app).get(`/api/tickets/${id}`).expect(200);

    const res = await patch(id, 'pending');
    expect((res.body as Ticket).sla).toMatchObject({ state: 'paused', remainingMinutes: 360 });

    freeze('2026-10-07T16:00:00Z');
    const detail = await request(desk.app).get(`/api/tickets/${id}`).expect(200);
    const list = await request(desk.app).get('/api/tickets?status=pending').expect(200);
    const listed = (list.body as Ticket[]).find((t) => t.id === id);
    expect((detail.body as Ticket).sla).toMatchObject({ state: 'paused', remainingMinutes: 360 });
    expect(listed?.sla).toMatchObject({ state: 'paused', remainingMinutes: 360 });
  });

  it('moves the due time later by the business minutes spent pending', async () => {
    freeze('2026-10-05T13:00:00Z');
    const id = await desk.receive({ from: 'pb@example.com', subject: 'Resume me' });
    freeze('2026-10-05T15:00:00Z');
    await patch(id, 'pending');
    freeze('2026-10-06T15:00:00Z');
    const res = await patch(id, 'open');

    expect((res.body as Ticket).sla.state).not.toBe('paused');
    expect((res.body as Ticket).sla.dueAt).toBe('2026-10-06T21:00:00.000Z');
  });

  it('reports met on the next read after closing from a cached read', async () => {
    freeze('2026-10-05T13:00:00Z');
    const id = await desk.receive({ from: 'pc@example.com', subject: 'Close me' });
    freeze('2026-10-05T14:00:00Z');
    await request(desk.app).get(`/api/tickets/${id}`).expect(200);
    await patch(id, 'closed');

    const res = await request(desk.app).get(`/api/tickets/${id}`).expect(200);
    expect((res.body as Ticket).sla.state).toBe('met');
  });
});

describe('unknown routes', () => {
  it('404s with a JSON error', async () => {
    const res = await request(desk.app).get('/api/nope').expect(404);
    expect(res.body).toEqual({ error: 'No such route' });
  });
});
