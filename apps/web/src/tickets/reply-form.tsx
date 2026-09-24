import { useState, type FormEvent } from 'react';

import type { Message } from '@front-desk/contract';

import { useCurrentTeammate } from '../teammates/current-teammate.tsx';
import { replyToTicket } from './tickets-api.ts';

export function ReplyForm({
  ticketId,
  onSent,
}: {
  ticketId: number;
  onSent: (m: Message) => void;
}) {
  const { current } = useCurrentTeammate();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!current || !body.trim()) return;
    setSending(true);
    setError(undefined);
    try {
      onSent(await replyToTicket(ticketId, { teammateId: current.id, body }));
      setBody('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="reply-form" onSubmit={(event) => void submit(event)}>
      <label htmlFor="reply-body">Reply</label>
      <textarea
        id="reply-body"
        rows={5}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Write a reply to the customer…"
      />
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={sending || !current || !body.trim()}>
        {sending ? 'Sending…' : `Send as ${current?.name ?? '…'}`}
      </button>
    </form>
  );
}
