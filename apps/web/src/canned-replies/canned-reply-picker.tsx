import { useState } from 'react';

import type { Message } from '@front-desk/contract';

import { useCurrentTeammate } from '../teammates/current-teammate.tsx';
import { useApi } from '../use-api.ts';
import { listCannedReplies, sendCannedReply } from './canned-replies-api.ts';

export function CannedReplyPicker({
  ticketId,
  onSent,
}: {
  ticketId: number;
  onSent: (message: Message) => void;
}) {
  const { data: replies = [] } = useApi(listCannedReplies, 'canned-replies');
  const { current } = useCurrentTeammate();
  const [selected, setSelected] = useState('');
  const [sending, setSending] = useState(false);
  const preview = replies.find((reply) => String(reply.id) === selected);

  async function send() {
    if (!preview || !current) return;
    setSending(true);
    try {
      onSent(await sendCannedReply(ticketId, preview.id, current.id));
      setSelected('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="canned-replies">
      <select
        aria-label="Canned reply"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">Canned reply…</option>
        {replies.map((reply) => (
          <option key={reply.id} value={reply.id}>
            {reply.title}
          </option>
        ))}
      </select>
      {preview ? (
        <>
          <pre className="canned-preview">{preview.body}</pre>
          <button type="button" disabled={sending || !current} onClick={() => void send()}>
            Send “{preview.title}”
          </button>
        </>
      ) : null}
    </div>
  );
}
