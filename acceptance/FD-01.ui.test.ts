import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi, priya, renderApp } from './support/web.ts';

const COUNTS: Record<string, Record<string, number>> = {
  open: { billing: 2, shipping: 1, spam: 0 },
  pending: { billing: 1, shipping: 0, spam: 0 },
  closed: { billing: 4, shipping: 0, spam: 3 },
  all: { billing: 7, shipping: 1, spam: 3 },
};

const TAGS = [
  { id: 1, name: 'billing', color: '#2b6cb0' },
  { id: 2, name: 'shipping', color: '#c05621' },
  { id: 3, name: 'spam', color: '#718096' },
];

function setup() {
  return fakeApi()
    .on('GET', '/teammates', [priya])
    .on('GET', '/tickets', [])
    .on('GET', '/tags', ({ query }) => {
      const counts = COUNTS[query.get('status') ?? 'all'] ?? {};
      return TAGS.map((tag) => ({ ...tag, ticketCount: counts[tag.name] }));
    });
}

async function tagLink(name: string): Promise<HTMLElement> {
  const sidebar = await screen.findByRole('navigation', { name: 'Tags' });
  return within(sidebar).findByRole('link', { name: new RegExp(`^${name}(?![a-z])`) });
}

async function expectCount(name: string, count: number): Promise<void> {
  const pattern = new RegExp(`^\\s*${name}\\D*${count}\\D*$`);
  await expect.poll(async () => (await tagLink(name)).textContent ?? '').toMatch(pattern);
}

describe('FD-01: tag counts in the sidebar', () => {
  it('shows a count after each tag name for the open view (1, 2)', async () => {
    setup();
    renderApp('/');
    await expectCount('billing', 2);
    await expectCount('shipping', 1);
  });

  it('shows zero for a tag with no tickets in the view (3)', async () => {
    setup();
    renderApp('/');
    await expectCount('spam', 0);
  });

  it('recounts when the inbox switches status (2)', async () => {
    setup();
    renderApp('/');
    await expectCount('billing', 2);

    const statuses = screen.getByRole('navigation', { name: 'Status' });
    await userEvent.click(within(statuses).getByRole('link', { name: 'Closed' }));
    await expectCount('billing', 4);
    await expectCount('spam', 3);

    await userEvent.click(within(statuses).getByRole('link', { name: 'All' }));
    await expectCount('billing', 7);
  });

  it('still filters the inbox by tag (7)', async () => {
    const api = setup();
    renderApp('/');
    await userEvent.click(await tagLink('billing'));
    expect(await screen.findByText(/tagged/)).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === '/tickets' && c.query.get('tag') === 'billing')).toBe(
      true,
    );
  });
});
