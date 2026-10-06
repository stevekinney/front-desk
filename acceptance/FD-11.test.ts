import { beforeAll, describe, expect, it } from 'vitest';

import { createDesk, type Desk } from './support/desk.ts';

interface Detail {
  id: number;
  tags: Array<{ name: string }>;
  messages: Array<{ body: string; createdAt: string }>;
}

let desk: Desk;

beforeAll(async () => {
  desk = await createDesk();
});

let counter = 0;
async function pair(): Promise<{ keep: number; duplicate: number; from: string }> {
  counter += 1;
  const from = `fd11-${counter}@example.com`;
  const keep = await desk.receive({ from, subject: 'Banner order', text: 'First note.' });
  const duplicate = await desk.receive({
    from,
    subject: 'Banner order (sent again)',
    text: 'Second note.',
  });
  return { keep, duplicate, from };
}

function merge(from: number, into: number) {
  return desk.post(`/api/tickets/${from}/merge`, { intoTicketId: into });
}

describe('FD-11: merge duplicate tickets', () => {
  it('returns the surviving ticket with both conversations, oldest first (2, 3)', async () => {
    const { keep, duplicate } = await pair();
    await desk.post(`/api/tickets/${keep}/replies`, {
      teammateId: desk.teammateId,
      body: 'Reply on the first one.',
    });

    const res = await merge(duplicate, keep).expect(200);
    const detail = res.body as Detail;
    expect(detail.id).toBe(keep);
    expect(detail.messages.map((m) => m.body)).toEqual(
      expect.arrayContaining(['First note.', 'Second note.', 'Reply on the first one.']),
    );
    expect(detail.messages).toHaveLength(3);
    const times = detail.messages.map((m) => m.createdAt);
    expect(times).toEqual([...times].sort());

    const again = (await desk.get(`/api/tickets/${keep}`).expect(200)).body as Detail;
    expect(again.messages).toHaveLength(3);
  });

  it('takes the merged ticket out of every inbox view (4)', async () => {
    const { keep, duplicate } = await pair();
    await merge(duplicate, keep).expect(200);
    for (const query of ['', '?status=open', '?status=pending', '?status=closed']) {
      const res = await desk.get(`/api/tickets${query}`).expect(200);
      expect((res.body as Array<{ id: number }>).map((t) => t.id)).not.toContain(duplicate);
    }
  });

  it('puts the tags from both tickets on the surviving ticket (5)', async () => {
    const { keep, duplicate } = await pair();
    await desk.tag(keep, 'printing');
    await desk.tag(duplicate, 'urgent');
    const detail = (await merge(duplicate, keep).expect(200)).body as Detail;
    expect(detail.tags.map((t) => t.name).sort()).toEqual(['printing', 'urgent']);
  });

  it('refuses to merge a ticket into itself (10)', async () => {
    const { keep } = await pair();
    await merge(keep, keep).expect(400);
  });

  it('answers 404 when either ticket does not exist (10)', async () => {
    const { keep } = await pair();
    for (const res of [await merge(keep, 999_999), await merge(999_999, keep)]) {
      expect(res.status).toBe(404);
      expect((res.body as { error?: string }).error).toMatch(/not found/i);
    }
  });

  it("files a reply to the merged ticket's conversation on the surviving ticket (11)", async () => {
    const { keep, duplicate, from } = await pair();
    await merge(duplicate, keep).expect(200);
    const replyTicket = await desk.receive({
      from,
      subject: `Re: Banner order (sent again) [#${duplicate}]`,
      text: 'Any update?',
    });
    expect(replyTicket).toBe(keep);
  });
});
