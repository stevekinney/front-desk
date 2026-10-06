import { expect, test } from '@playwright/test';

import { deliverMail } from './support/desk.ts';

test('an incoming email shows up in the inbox and opens as a ticket', async ({ page, request }) => {
  const mail = await deliverMail(request, 'wrong-size');

  await page.goto('/');
  const tickets = page.getByRole('region', { name: 'Tickets' });
  await tickets.getByRole('link', { name: new RegExp(`#${mail.ticketId} `) }).click();

  await expect(page).toHaveURL(`/tickets/${mail.ticketId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Posters printed at the wrong size',
  );
  await expect(page.getByRole('list', { name: 'Messages' })).toContainText(
    'I ordered 18x24 posters and received 11x17.',
  );
});
