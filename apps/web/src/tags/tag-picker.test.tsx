import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mockApi } from '../../test/mock-api.ts';
import { TagPicker } from './tag-picker.tsx';

const billing = { id: 1, name: 'billing', color: '#2b6cb0' };
const urgent = { id: 2, name: 'urgent', color: '#c53030' };

describe('TagPicker', () => {
  it('offers only tags the ticket does not have', async () => {
    mockApi().on('GET', '/tags', [billing, urgent]);
    render(<TagPicker ticketId={7} tags={[billing]} onChange={() => {}} />);

    await screen.findByRole('option', { name: 'urgent' });
    expect(screen.queryByRole('option', { name: 'billing' })).not.toBeInTheDocument();
  });

  it('adds a tag', async () => {
    mockApi()
      .on('GET', '/tags', [billing, urgent])
      .on('PUT', '/tickets/7/tags/2', [billing, urgent]);
    const onChange = vi.fn();
    render(<TagPicker ticketId={7} tags={[billing]} onChange={onChange} />);

    await screen.findByRole('option', { name: 'urgent' });
    await userEvent.selectOptions(screen.getByLabelText('Add tag'), 'urgent');

    expect(onChange).toHaveBeenCalledWith([billing, urgent]);
  });

  it('removes a tag', async () => {
    mockApi().on('GET', '/tags', [billing]).on('DELETE', '/tickets/7/tags/1', []);
    const onChange = vi.fn();
    render(<TagPicker ticketId={7} tags={[billing]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove billing' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
