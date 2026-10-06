import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi, priya, renderApp } from './support/web.ts';

const DEFAULTS = { openHour: 9, closeHour: 17, timeZone: 'America/New_York', slaHours: 8 };

/** Set a field whether it is a text box, a number box or a select. */
async function setField(label: RegExp, value: string): Promise<void> {
  const field = await screen.findByLabelText(label);
  if (field instanceof HTMLSelectElement) {
    await userEvent.selectOptions(field, value);
  } else {
    await userEvent.clear(field);
    await userEvent.type(field, value);
  }
}

describe('FD-07: the settings page', () => {
  it('is linked from the header and shows the current settings (6)', async () => {
    fakeApi()
      .on('GET', '/teammates', [priya])
      .on('GET', '/tags', [])
      .on('GET', '/tickets', [])
      .on('GET', '/settings/business-hours', DEFAULTS);
    renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'Settings' }));
    const opens = (await screen.findByLabelText(/Opens at/)) as HTMLInputElement;
    await expect.poll(() => opens.value).toBe('9');
    expect((screen.getByLabelText(/Time zone/) as HTMLInputElement).value).toBe('America/New_York');
  });

  it('saves changed settings (6)', async () => {
    const api = fakeApi()
      .on('GET', '/teammates', [priya])
      .on('GET', '/settings/business-hours', DEFAULTS)
      .on('PUT', '/settings/business-hours', ({ body }) => body as object);
    renderApp('/settings');

    await setField(/Opens at/, '8');
    await setField(/Closes at/, '16');
    await setField(/Time zone/, 'Europe/London');
    await setField(/SLA hours/, '6');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await expect
      .poll(() => api.calls.find((c) => c.method === 'PUT')?.body)
      .toEqual({ openHour: 8, closeHour: 16, timeZone: 'Europe/London', slaHours: 6 });
  });
});
