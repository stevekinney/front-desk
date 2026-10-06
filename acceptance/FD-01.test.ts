import { beforeAll, describe, expect, it } from 'vitest';

import { generatedTypesAreCurrent, readContract } from './support/contract.ts';
import { createDesk, type Desk } from './support/desk.ts';

interface CountedTag {
  name: string;
  ticketCount: unknown;
}

let desk: Desk;

beforeAll(async () => {
  desk = await createDesk();
  const charged = await desk.receive({ from: 'ana@example.com', subject: 'Charged twice' });
  const refund = await desk.receive({ from: 'ben@example.com', subject: 'Refund for order' });
  const invoice = await desk.receive({ from: 'cy@example.com', subject: 'Invoice copy' });
  const late = await desk.receive({ from: 'di@example.com', subject: 'Parcel is late' });
  await desk.tag(charged, 'billing');
  await desk.tag(refund, 'billing');
  await desk.tag(invoice, 'billing');
  await desk.tag(late, 'shipping');
  await desk.tag(charged, 'urgent');
  await desk.post('/api/tags', { name: 'spam', color: '#718096' }).expect(201);
  await desk.setStatus(invoice, 'closed');
  await desk.setStatus(refund, 'pending');
});

async function counts(query = ''): Promise<Record<string, unknown>> {
  const res = await desk.get(`/api/tags${query}`).expect(200);
  const tags = res.body as CountedTag[];
  return Object.fromEntries(tags.map((tag) => [tag.name, tag.ticketCount]));
}

describe('FD-01: tag counts', () => {
  it('counts every ticket with each tag when no status is given (4)', async () => {
    expect(await counts()).toEqual({ billing: 3, shipping: 1, urgent: 1, spam: 0 });
  });

  it('counts only tickets in the requested status (2, 4)', async () => {
    expect(await counts('?status=open')).toEqual({ billing: 1, shipping: 1, urgent: 1, spam: 0 });
    expect(await counts('?status=pending')).toEqual({
      billing: 1,
      shipping: 0,
      urgent: 0,
      spam: 0,
    });
    expect(await counts('?status=closed')).toEqual({ billing: 1, shipping: 0, urgent: 0, spam: 0 });
  });

  it('keeps tags with no tickets, counted as zero (3)', async () => {
    const res = await desk.get('/api/tags?status=closed').expect(200);
    expect((res.body as CountedTag[]).map((tag) => tag.name)).toContain('spam');
  });

  it('rejects an unknown status (5)', async () => {
    await desk.get('/api/tags?status=archived').expect(400);
  });

  it('follows tag changes right away (4)', async () => {
    const id = await desk.receive({ from: 'ed@example.com', subject: 'Another refund' });
    await desk.tag(id, 'billing');
    expect((await counts('?status=open')).billing).toBe(2);
  });

  it('documents the count in the contract and regenerates the types (6)', () => {
    expect(readContract()).toContain('ticketCount');
    expect(generatedTypesAreCurrent()).toBe(true);
  });
});
