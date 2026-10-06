import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Message } from '@front-desk/contract';

import { dana, makeTicket, makeTicketDetail, mockApi, priya } from '../../test/mock-api.ts';
import { renderApp } from '../../test/render.tsx';

function setup() {
  return mockApi()
    .on('GET', '/teammates', [priya, dana])
    .on('GET', '/tags', [])
    .on('GET', '/canned-replies', [])
    .on('GET', '/tickets/1', makeTicketDetail());
}

describe('TicketDetailPage', () => {
  it('shows the ticket and its messages', async () => {
    setup();
    renderApp('/tickets/1');

    expect(
      await screen.findByRole('heading', { name: 'Business cards arrived bent' }),
    ).toBeInTheDocument();
    expect(screen.getByText('About a third of them are bent.')).toBeInTheDocument();
    expect(screen.getByText('Due in 5h')).toBeInTheDocument();
  });

  it('shows a paused badge for a pending ticket', async () => {
    setup().on(
      'GET',
      '/tickets/1',
      makeTicketDetail({
        status: 'pending',
        sla: { dueAt: '2026-10-06T20:00:00.000Z', state: 'paused', remainingMinutes: 300 },
      }),
    );
    renderApp('/tickets/1');

    expect(await screen.findByText(/^Paused/)).toBeInTheDocument();
    expect(screen.queryByText(/^Due in/)).not.toBeInTheDocument();
  });

  it('sends a reply as the current teammate', async () => {
    const reply: Message = {
      id: 11,
      direction: 'outbound',
      author: priya,
      fromName: 'Priya Raman',
      fromEmail: 'help@frontdesk.example',
      body: 'A replacement is on its way.',
      sentAt: '2026-10-06T14:00:00.000Z',
      createdAt: '2026-10-06T14:00:00.000Z',
      delivery: {
        to: 'theo@example.com',
        subject: 'Re: Business cards [#1]',
        queuedAt: '2026-10-06T14:00:00.000Z',
      },
    };
    const api = setup().on('POST', '/tickets/1/replies', reply);
    // After the reply, the server's copy of the ticket includes it.
    api.on('GET', '/tickets/1', () => {
      const replied = api.calls.some((c) => c.method === 'POST');
      const detail = makeTicketDetail();
      return replied ? { ...detail, messages: [...detail.messages, reply] } : detail;
    });
    renderApp('/tickets/1');

    await userEvent.type(await screen.findByLabelText('Reply'), 'A replacement is on its way.');
    await userEvent.click(await screen.findByRole('button', { name: 'Send as Priya Raman' }));

    expect(await screen.findByText('A replacement is on its way.')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      teammateId: priya.id,
      body: 'A replacement is on its way.',
    });
  });

  it('assigns the ticket', async () => {
    const api = setup().on('PUT', '/tickets/1/assignee', makeTicket({ assignee: dana }));
    renderApp('/tickets/1');

    await userEvent.selectOptions(await screen.findByLabelText('Assignee'), 'Dana Whitfield');

    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({ teammateId: dana.id });
    expect(await screen.findByDisplayValue('Dana Whitfield')).toBeInTheDocument();
  });

  it('closes and reopens the ticket', async () => {
    const api = setup().on('PATCH', '/tickets/1/status', (body) =>
      makeTicket({
        status: (body as { status: 'open' | 'closed' }).status,
        sla: { dueAt: '2026-10-06T20:00:00.000Z', state: 'met', remainingMinutes: null },
      }),
    );
    renderApp('/tickets/1');

    await userEvent.click(await screen.findByRole('button', { name: 'Close ticket' }));
    expect(await screen.findByText('SLA met')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(api.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([
      { status: 'closed' },
      { status: 'open' },
    ]);
  });
});
