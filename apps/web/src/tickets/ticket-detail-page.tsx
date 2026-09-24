import { Link, useParams } from 'react-router';

import type { Message, Ticket, TicketDetail, TicketStatus } from '@front-desk/contract';

import { CannedReplyPicker } from '../canned-replies/canned-reply-picker.tsx';
import { TagPicker } from '../tags/tag-picker.tsx';
import { useCurrentTeammate } from '../teammates/current-teammate.tsx';
import { useApi } from '../use-api.ts';
import { ReplyForm } from './reply-form.tsx';
import { SlaBadge } from './sla-badge.tsx';
import { assignTicket, getTicket, updateStatus } from './tickets-api.ts';

export function TicketDetailPage() {
  const ticketId = Number(useParams().ticketId);
  const {
    data: ticket,
    error,
    reload,
    setData,
  } = useApi(() => getTicket(ticketId), `ticket:${ticketId}`);
  const { teammates } = useCurrentTeammate();

  if (error) {
    return (
      <div className="detail">
        <p role="alert">
          Could not load ticket #{ticketId}: {error.message}
        </p>
        <Link to="/">Back to the inbox</Link>
      </div>
    );
  }
  if (!ticket) return <p className="detail">Loading…</p>;

  const merge = (updated: Ticket) => setData({ ...ticket, ...updated } satisfies TicketDetail);
  const addMessage = (message: Message) => {
    setData({ ...ticket, messages: [...ticket.messages, message] });
    reload();
  };
  const changeStatus = async (status: TicketStatus) => merge(await updateStatus(ticket.id, status));

  return (
    <article className="detail">
      <Link to="/" className="back">
        ← Inbox
      </Link>
      <header className="detail-header">
        <h1>{ticket.subject}</h1>
        <div className="detail-meta">
          <span className={`badge status status-${ticket.status}`}>{ticket.status}</span>
          <SlaBadge sla={ticket.sla} />
          <span>
            #{ticket.id} from {ticket.customer.name ?? ticket.customer.email} &lt;
            {ticket.customer.email}&gt;
            {ticket.customer.vip ? <span className="badge vip">VIP</span> : null}
          </span>
        </div>
      </header>

      <section className="controls" aria-label="Ticket controls">
        <label>
          Assignee{' '}
          <select
            value={ticket.assignee?.id ?? ''}
            onChange={(event) =>
              void assignTicket(
                ticket.id,
                event.target.value ? Number(event.target.value) : null,
              ).then(merge)
            }
          >
            <option value="">Unassigned</option>
            {teammates.map((teammate) => (
              <option key={teammate.id} value={teammate.id}>
                {teammate.name}
              </option>
            ))}
          </select>
        </label>
        <TagPicker
          ticketId={ticket.id}
          tags={ticket.tags}
          onChange={(tags) => setData({ ...ticket, tags })}
        />
        <div className="status-buttons">
          {ticket.status !== 'pending' && ticket.status !== 'closed' ? (
            <button
              type="button"
              className="secondary"
              onClick={() => void changeStatus('pending')}
            >
              Waiting on customer
            </button>
          ) : null}
          {ticket.status === 'closed' ? (
            <button type="button" className="secondary" onClick={() => void changeStatus('open')}>
              Reopen
            </button>
          ) : (
            <button type="button" onClick={() => void changeStatus('closed')}>
              Close ticket
            </button>
          )}
        </div>
      </section>

      <ol className="thread" aria-label="Messages">
        {ticket.messages.map((message) => (
          <li key={message.id} className={`message message-${message.direction}`}>
            <header>
              <strong>
                {message.direction === 'outbound'
                  ? (message.author?.name ?? message.fromName)
                  : (message.fromName ?? message.fromEmail)}
              </strong>
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString()}
              </time>
              {message.delivery ? (
                <span
                  className="badge sent"
                  title={`To ${message.delivery.to}: ${message.delivery.subject}`}
                >
                  Sent
                </span>
              ) : null}
            </header>
            <p className="message-body">{message.body}</p>
          </li>
        ))}
      </ol>

      <ReplyForm ticketId={ticket.id} onSent={addMessage} />
      <CannedReplyPicker ticketId={ticket.id} onSent={addMessage} />
    </article>
  );
}
