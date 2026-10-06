import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { makeTicket, mockApi, priya } from '../../test/mock-api.ts';
import { renderApp } from '../../test/render.tsx';

const hours = { openHour: 9, closeHour: 17, timeZone: 'America/New_York', slaHours: 8 };

describe('settings page', () => {
  it('opens from the header link with the current settings filled in', async () => {
    mockApi()
      .on('GET', '/teammates', [priya])
      .on('GET', '/tags?status=open', [])
      .on('GET', '/tickets?status=open', [makeTicket()])
      .on('GET', '/settings/business-hours', hours);
    renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'Settings' }));

    expect(await screen.findByLabelText('Opens at')).toHaveValue(9);
    expect(screen.getByLabelText('Closes at')).toHaveValue(17);
    expect(screen.getByLabelText('Time zone')).toHaveValue('America/New_York');
    expect(screen.getByLabelText('SLA hours')).toHaveValue(8);
  });

  it('saves edited settings, sending numbers for the numeric fields', async () => {
    const api = mockApi()
      .on('GET', '/teammates', [priya])
      .on('GET', '/settings/business-hours', hours)
      .on('PUT', '/settings/business-hours', (body) => body);
    renderApp('/settings');

    const opens = await screen.findByLabelText('Opens at');
    await userEvent.clear(opens);
    await userEvent.type(opens, '8');
    const zone = screen.getByLabelText('Time zone');
    await userEvent.clear(zone);
    await userEvent.type(zone, 'Europe/London');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    const put = api.calls.find((call) => call.method === 'PUT');
    expect(put?.body).toEqual({
      openHour: 8,
      closeHour: 17,
      timeZone: 'Europe/London',
      slaHours: 8,
    });
  });
});
