import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi, makeTicket, makeTicketDetail, priya, renderApp } from './support/web.ts';

type Ticket = ReturnType<typeof makeTicket>;

// `priority` is the field this feature adds.
const withPriority = (ticket: Ticket, priority: string): Ticket =>
  ({ ...ticket, priority }) as unknown as Ticket;

describe('FD-06: priority in the web app', () => {
  it('labels high and urgent tickets in the inbox (5)', async () => {
    fakeApi()
      .on('GET', '/teammates', [priya])
      .on('GET', '/tags', [])
      .on('GET', '/tickets', [
        withPriority(makeTicket({ id: 1, subject: 'Wedding invites misprinted' }), 'urgent'),
        withPriority(makeTicket({ id: 2, subject: 'Need a quote' }), 'high'),
        withPriority(makeTicket({ id: 3, subject: 'Just saying thanks' }), 'normal'),
      ]);
    renderApp('/');

    const row = async (subject: string) =>
      (await screen.findByText(subject)).closest('a') as HTMLElement;
    expect(within(await row('Wedding invites misprinted')).getByText('Urgent')).toBeInTheDocument();
    expect(within(await row('Need a quote')).getByText('High')).toBeInTheDocument();
    const normal = await row('Just saying thanks');
    expect(within(normal).queryByText(/^(Urgent|High|Normal|Low)$/)).not.toBeInTheDocument();
  });

  it('changes priority from the ticket page (5)', async () => {
    const api = fakeApi()
      .on('GET', '/teammates', [priya])
      .on('GET', '/tags', [])
      .on('GET', '/canned-replies', [])
      .on('GET', '/tickets/1', withPriority(makeTicketDetail(), 'normal'))
      .on('PATCH', '/tickets/1/priority', ({ body }) =>
        withPriority(makeTicket(), (body as { priority: string }).priority),
      );
    renderApp('/tickets/1');

    const select = await screen.findByRole('combobox', { name: /Priority/ });
    expect(select).toHaveValue('normal');
    await userEvent.selectOptions(select, 'high');

    await expect
      .poll(() => api.calls.find((c) => c.method === 'PATCH' && c.path === '/tickets/1/priority'))
      .toMatchObject({ body: { priority: 'high' } });
    expect(await screen.findByRole('combobox', { name: /Priority/ })).toHaveValue('high');
  });
});
