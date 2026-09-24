import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { makeTicket, mockApi, priya } from '../../test/mock-api.ts';
import { renderApp } from '../../test/render.tsx';

const billing = { id: 1, name: 'billing', color: '#2b6cb0' };

function setup() {
  return mockApi()
    .on('GET', '/teammates', [priya])
    .on('GET', '/tags', [billing])
    .on('GET', '/tickets?status=open', [
      makeTicket({ id: 1, subject: 'Charged twice', tags: [billing], assignee: priya }),
      makeTicket({
        id: 2,
        subject: 'Upload stops at 99%',
        customer: { id: 2, name: 'Kenji', email: 'kenji@example.com', vip: true },
        sla: { dueAt: '2026-10-05T20:00:00.000Z', state: 'breached', remainingMinutes: -120 },
      }),
    ])
    .on('GET', '/tickets?status=closed', [
      makeTicket({ id: 3, subject: 'All done', status: 'closed' }),
    ])
    .on('GET', '/tickets?status=open&tag=billing', [
      makeTicket({ id: 1, subject: 'Charged twice' }),
    ]);
}

describe('InboxPage', () => {
  it('lists open tickets with assignee, tags, VIP, and SLA', async () => {
    setup();
    renderApp('/');

    const list = await screen.findByRole('region', { name: 'Tickets' });
    const first = (await within(list).findByText('Charged twice')).closest('a') as HTMLElement;
    expect(within(first).getByText(/Priya Raman/)).toBeInTheDocument();
    expect(within(first).getByText('billing')).toBeInTheDocument();
    expect(within(first).getByText('Due in 5h')).toBeInTheDocument();

    const second = within(list).getByText('Upload stops at 99%').closest('a') as HTMLElement;
    expect(within(second).getByText('VIP')).toBeInTheDocument();
    expect(within(second).getByText('Overdue 2h')).toBeInTheDocument();
    expect(within(second).getByText(/Unassigned/)).toBeInTheDocument();
  });

  it('switches status from the sidebar', async () => {
    setup();
    renderApp('/');
    await screen.findByText('Charged twice');

    await userEvent.click(screen.getByRole('link', { name: 'Closed' }));

    expect(await screen.findByText('All done')).toBeInTheDocument();
    expect(screen.queryByText('Charged twice')).not.toBeInTheDocument();
  });

  it('filters by tag', async () => {
    const api = setup();
    renderApp('/');
    const tags = await screen.findByRole('navigation', { name: 'Tags' });

    await userEvent.click(await within(tags).findByRole('link', { name: 'billing' }));

    expect(await screen.findByText(/tagged/)).toBeInTheDocument();
    expect(api.calls.map((c) => c.path)).toContain('/tickets?status=open&tag=billing');
  });

  it('links each ticket to its detail page', async () => {
    setup();
    renderApp('/');
    const link = (await screen.findByText('Charged twice')).closest('a');
    expect(link).toHaveAttribute('href', '/tickets/1');
  });
});
