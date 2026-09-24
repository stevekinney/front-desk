import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mockApi, priya } from '../../test/mock-api.ts';
import { CurrentTeammateProvider } from '../teammates/current-teammate.tsx';
import { CannedReplyPicker } from './canned-reply-picker.tsx';

const template = { id: 3, title: 'Need your order number', body: 'Hi {{customer.name}}, ...' };

describe('CannedReplyPicker', () => {
  it('previews a template and sends it as the current teammate', async () => {
    const sent = { id: 99, body: 'Hi Theo, ...' };
    const api = mockApi()
      .on('GET', '/teammates', [priya])
      .on('GET', '/canned-replies', [template])
      .on('POST', '/tickets/5/canned-replies/3', sent);
    const onSent = vi.fn();
    render(
      <CurrentTeammateProvider>
        <CannedReplyPicker ticketId={5} onSent={onSent} />
      </CurrentTeammateProvider>,
    );

    await screen.findByRole('option', { name: template.title });
    await userEvent.selectOptions(screen.getByLabelText('Canned reply'), template.title);
    expect(screen.getByText(template.body)).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole('button', { name: /Send “Need your order number”/ }),
    );

    expect(onSent).toHaveBeenCalledWith(sent);
    expect(api.calls.at(-1)).toMatchObject({ method: 'POST', body: { teammateId: priya.id } });
  });
});
