import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi, makeTicket, makeTicketDetail, priya, renderApp } from './support/web.ts';

type Sla = ReturnType<typeof makeTicket>['sla'];

// `paused` is the new SLA state this feature adds.
const paused = {
  dueAt: '2026-10-06T21:00:00.000Z',
  state: 'paused',
  remainingMinutes: 420,
} as unknown as Sla;

describe('FD-04: the badge for a pending ticket', () => {
  it('reads "Paused" in the inbox (6)', async () => {
    fakeApi()
      .on('GET', '/teammates', [priya])
      .on('GET', '/tags', [])
      .on('GET', '/tickets', [
        makeTicket({ id: 7, subject: 'Waiting on artwork', status: 'pending', sla: paused }),
      ]);
    renderApp('/?status=pending');

    const row = (await screen.findByText('Waiting on artwork')).closest('a') as HTMLElement;
    expect(within(row).getByText(/^Paused/)).toBeInTheDocument();
    expect(within(row).queryByText(/Due in|Overdue/)).not.toBeInTheDocument();
  });

  it('switches to "Paused" when a teammate marks the ticket as waiting (6)', async () => {
    const pendingTicket = makeTicket({ status: 'pending', sla: paused });
    fakeApi()
      .on('GET', '/teammates', [priya])
      .on('GET', '/tags', [])
      .on('GET', '/canned-replies', [])
      .on('GET', '/tickets/1', makeTicketDetail())
      .on('PATCH', '/tickets/1/status', pendingTicket);
    renderApp('/tickets/1');

    await userEvent.click(await screen.findByRole('button', { name: 'Waiting on customer' }));
    expect(await screen.findByText(/^Paused/)).toBeInTheDocument();
  });
});
