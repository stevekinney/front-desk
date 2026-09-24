import { useState } from 'react';

import type { SimulatedMail } from '@front-desk/contract';

import { apiRequest } from '../api-client.ts';

/** Same as `npm run mail:drop`, from the browser. */
export function SimulateMailButton({
  onDelivered,
}: {
  onDelivered: (mail: SimulatedMail) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function simulate() {
    setBusy(true);
    try {
      onDelivered(await apiRequest<SimulatedMail>('/mail/simulate', { method: 'POST', body: {} }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="secondary" disabled={busy} onClick={() => void simulate()}>
      {busy ? 'Delivering…' : 'Simulate incoming email'}
    </button>
  );
}
