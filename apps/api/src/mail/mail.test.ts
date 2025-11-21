import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestDesk, type TestDesk } from '../../test/helpers.ts';

let desk: TestDesk;

beforeAll(async () => {
  desk = await createTestDesk();
});

describe('simulated mail', () => {
  it('lists the fixtures', async () => {
    const res = await request(desk.app).get('/api/mail/fixtures').expect(200);
    expect(res.body).toContain('refund-request');
  });

  it('drops a fixture into the inbox and turns it into a ticket', async () => {
    const res = await request(desk.app)
      .post('/api/mail/simulate')
      .send({ fixture: 'late-delivery' })
      .expect(201);

    expect(res.body).toMatchObject({ created: true });
    expect(res.body.filename).toMatch(/^drop-\d+-late-delivery\.json$/);
    const ticket = await request(desk.app).get(`/api/tickets/${res.body.ticketId}`).expect(200);
    expect(ticket.body.subject).toBe('Order is a week late');
  });

  it('picks a fixture when none is named', async () => {
    const res = await request(desk.app).post('/api/mail/simulate').expect(201);
    expect(res.body.ticketId).toBeGreaterThan(0);
  });

  it('400s for an unknown fixture', async () => {
    await request(desk.app).post('/api/mail/simulate').send({ fixture: 'nope' }).expect(400);
  });
});
