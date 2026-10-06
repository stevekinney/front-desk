import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import type { Tag, TagWithCount, Ticket } from '@front-desk/contract';

import { createTestDesk, type TestDesk } from '../../test/helpers.ts';

let desk: TestDesk;

beforeAll(async () => {
  desk = await createTestDesk();
});

async function createTag(name: string, color?: string): Promise<Tag> {
  const res = await request(desk.app).post('/api/tags').send({ name, color }).expect(201);
  return res.body as Tag;
}

describe('tags', () => {
  it('creates a tag with a default color and lists it', async () => {
    const tag = await createTag('refunds');
    expect(tag).toMatchObject({ name: 'refunds', color: '#4a5568' });

    const res = await request(desk.app).get('/api/tags').expect(200);
    expect((res.body as Tag[]).map((t) => t.name)).toContain('refunds');
  });

  it('refuses a duplicate name, ignoring case', async () => {
    await createTag('wholesale');
    await request(desk.app).post('/api/tags').send({ name: 'Wholesale' }).expect(409);
  });

  it('validates the color', async () => {
    const res = await request(desk.app)
      .post('/api/tags')
      .send({ name: 'bad-color', color: 'green' })
      .expect(400);
    expect(res.body.issues[0].path).toBe('color');
  });

  it('adds and removes a tag on a ticket', async () => {
    const tag = await createTag('returns', '#c05621');
    const ticketId = await desk.receive({ from: 'lu@example.com', subject: 'Return' });

    const added = await request(desk.app)
      .put(`/api/tickets/${ticketId}/tags/${tag.id}`)
      .expect(200);
    expect(added.body).toEqual([tag]);

    // Adding twice is harmless.
    await request(desk.app).put(`/api/tickets/${ticketId}/tags/${tag.id}`).expect(200);

    const removed = await request(desk.app)
      .delete(`/api/tickets/${ticketId}/tags/${tag.id}`)
      .expect(200);
    expect(removed.body).toEqual([]);
  });

  it('filters tickets by tag name', async () => {
    const tag = await createTag('press');
    const tagged = await desk.receive({ from: 'mo@example.com', subject: 'Interview request' });
    const untagged = await desk.receive({ from: 'ned@example.com', subject: 'Other' });
    await request(desk.app).put(`/api/tickets/${tagged}/tags/${tag.id}`);

    const res = await request(desk.app).get('/api/tickets?tag=press').expect(200);
    const ids = (res.body as Ticket[]).map((t) => t.id);

    expect(ids).toContain(tagged);
    expect(ids).not.toContain(untagged);
  });

  it('404s for a missing ticket or tag', async () => {
    const tag = await createTag('ghost');
    const ticketId = await desk.receive({ from: 'oz@example.com', subject: 'Real' });
    await request(desk.app).put(`/api/tickets/999999/tags/${tag.id}`).expect(404);
    await request(desk.app).put(`/api/tickets/${ticketId}/tags/999999`).expect(404);
  });

  describe('ticket counts', () => {
    async function countFor(tagId: number, status?: string): Promise<number | undefined> {
      const res = await request(desk.app)
        .get('/api/tags')
        .query(status ? { status } : {})
        .expect(200);
      return (res.body as TagWithCount[]).find((t) => t.id === tagId)?.ticketCount;
    }

    it('counts tickets by status and follows tag changes', async () => {
      const tag = await createTag('counted');
      const ids = [
        await desk.receive({ from: 'c1@example.com', subject: 'Count one' }),
        await desk.receive({ from: 'c2@example.com', subject: 'Count two' }),
        await desk.receive({ from: 'c3@example.com', subject: 'Count three' }),
      ];
      for (const id of ids) await request(desk.app).put(`/api/tickets/${id}/tags/${tag.id}`);
      await request(desk.app)
        .patch(`/api/tickets/${ids[2]}/status`)
        .send({ status: 'closed' })
        .expect(200);

      expect(await countFor(tag.id)).toBe(3);
      expect(await countFor(tag.id, 'open')).toBe(2);
      expect(await countFor(tag.id, 'closed')).toBe(1);
      expect(await countFor(tag.id, 'pending')).toBe(0);

      await request(desk.app).delete(`/api/tickets/${ids[0]}/tags/${tag.id}`).expect(200);
      expect(await countFor(tag.id)).toBe(2);
      expect(await countFor(tag.id, 'open')).toBe(1);
    });

    it('lists an untagged tag with a count of 0', async () => {
      const tag = await createTag('lonely');
      expect(await countFor(tag.id)).toBe(0);
      expect(await countFor(tag.id, 'open')).toBe(0);
    });

    it('returns a numeric ticketCount for every tag', async () => {
      const res = await request(desk.app).get('/api/tags').expect(200);
      for (const tag of res.body as TagWithCount[]) expect(typeof tag.ticketCount).toBe('number');
    });

    it('rejects an unknown status', async () => {
      const res = await request(desk.app).get('/api/tags?status=archived').expect(400);
      expect(res.body.issues[0].path).toBe('status');
    });
  });
});
