import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  fakeApi,
  makeTicket,
  makeTicketDetail,
  priya,
  renderApp,
  reply,
  type FakeRequest,
} from './support/web.ts';

const created = makeTicket({
  id: 42,
  subject: 'Phone order: 500 loyalty cards',
  customer: { id: 9, name: 'Olivia Chen', email: 'olivia@harborbakery.example', vip: false },
});

function setup() {
  return fakeApi()
    .on('GET', '/teammates', [priya])
    .on('GET', '/tags', [])
    .on('GET', '/canned-replies', [])
    .on('GET', '/tickets', [])
    .on('POST', '/tickets', ({ body }: FakeRequest) => {
      const input = body as Record<string, string | undefined>;
      if (!input.customerEmail?.includes('@') || !input.subject?.trim() || !input.body?.trim()) {
        return reply(400, { error: 'Invalid request' });
      }
      return reply(201, created);
    })
    .on('GET', '/tickets/42', {
      ...makeTicketDetail(),
      ...created,
      messages: [
        {
          ...makeTicketDetail().messages[0],
          fromName: 'Olivia Chen',
          fromEmail: 'olivia@harborbakery.example',
          body: 'Called in to order 500 loyalty cards.',
        },
      ],
    });
}

async function openForm(): Promise<void> {
  renderApp('/');
  // A link or a button: either is fine.
  await userEvent.click(await screen.findByText('New ticket'));
  await screen.findByLabelText(/Customer email/);
}

describe('FD-05: new ticket form', () => {
  it('creates the ticket and opens it (1, 3)', async () => {
    const api = setup();
    await openForm();

    await userEvent.type(screen.getByLabelText(/Customer email/), 'olivia@harborbakery.example');
    await userEvent.type(screen.getByLabelText(/Customer name/), 'Olivia Chen');
    await userEvent.type(screen.getByLabelText(/Subject/), 'Phone order: 500 loyalty cards');
    await userEvent.type(screen.getByLabelText(/Message/), 'Called in to order 500 loyalty cards.');
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }));

    expect(
      await screen.findByRole('heading', { name: 'Phone order: 500 loyalty cards' }),
    ).toBeInTheDocument();
    const thread = screen.getByRole('list', { name: 'Messages' });
    expect(within(thread).getByText('Called in to order 500 loyalty cards.')).toBeInTheDocument();
    const post = api.calls.find((c) => c.method === 'POST' && c.path === '/tickets');
    expect(post?.body).toMatchObject({
      customerEmail: 'olivia@harborbakery.example',
      customerName: 'Olivia Chen',
      subject: 'Phone order: 500 loyalty cards',
      body: 'Called in to order 500 loyalty cards.',
    });
  });

  it('stays on the form when required fields are missing (5)', async () => {
    setup();
    await openForm();

    await userEvent.type(screen.getByLabelText(/Customer email/), 'olivia@harborbakery.example');
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }));

    expect(screen.getByRole('button', { name: 'Create ticket' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Phone order: 500 loyalty cards' }),
    ).not.toBeInTheDocument();
  });
});
