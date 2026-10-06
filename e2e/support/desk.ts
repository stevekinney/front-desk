/**
 * Arrange data for a browser test through the API, so the test drives only the
 * part of the UI it is about. Every test shares one desk: make the tickets a
 * test changes instead of changing seeded ones.
 */
import { expect, type APIRequestContext } from '@playwright/test';

import type { SimulatedMail, TicketDetail } from '@front-desk/contract';

/** Deliver a fixture from fixtures/mail/ and wait for the mailroom to ingest it. */
export async function deliverMail(
  request: APIRequestContext,
  fixture: string,
): Promise<SimulatedMail> {
  const response = await request.post('/api/mail/simulate', { data: { fixture } });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as SimulatedMail;
}

export async function getTicket(request: APIRequestContext, id: number): Promise<TicketDetail> {
  const response = await request.get(`/api/tickets/${id}`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as TicketDetail;
}
