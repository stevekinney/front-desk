import { Link, useSearchParams } from 'react-router';

import { TICKET_STATUSES, type TicketStatus } from '@front-desk/contract';

import { SimulateMailButton } from '../mail/simulate-mail-button.tsx';
import { TagChip } from '../tags/tag-chip.tsx';
import { TagSidebar } from '../tags/tag-sidebar.tsx';
import { useApi } from '../use-api.ts';
import { PriorityBadge } from './priority-badge.tsx';
import { SlaBadge } from './sla-badge.tsx';
import { listTickets } from './tickets-api.ts';

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  closed: 'Closed',
};

function parseStatus(value: string | null): TicketStatus | undefined {
  return TICKET_STATUSES.find((status) => status === value);
}

export function InboxPage() {
  const [params] = useSearchParams();
  const status = params.has('status') ? parseStatus(params.get('status')) : 'open';
  const tag = params.get('tag') ?? undefined;
  const {
    data: tickets,
    error,
    loading,
    reload,
  } = useApi(() => listTickets({ status, tag }), `${status ?? 'all'}:${tag ?? ''}`);

  const statusLink = (value: TicketStatus | 'all') => {
    const next = new URLSearchParams(params);
    next.set('status', value);
    return `/?${next.toString()}`;
  };
  const currentStatus = status ?? 'all';

  return (
    <div className="inbox">
      <aside className="sidebar">
        <nav aria-label="Status" className="sidebar-section">
          <h2>Inbox</h2>
          <ul>
            {[...TICKET_STATUSES, 'all' as const].map((value) => (
              <li key={value}>
                <Link
                  to={statusLink(value)}
                  className={currentStatus === value ? 'active' : undefined}
                >
                  {value === 'all' ? 'All' : STATUS_LABELS[value]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <TagSidebar status={status} />
      </aside>

      <section className="ticket-list" aria-label="Tickets">
        <header className="list-header">
          <h1>
            {currentStatus === 'all' ? 'All tickets' : `${STATUS_LABELS[currentStatus]} tickets`}
            {tag ? (
              <span className="filter">
                {' '}
                tagged <strong>{tag}</strong> <Link to={statusLink(currentStatus)}>clear</Link>
              </span>
            ) : null}
          </h1>
          <SimulateMailButton onDelivered={reload} />
        </header>

        {error ? <p role="alert">Could not load tickets: {error.message}</p> : null}
        {loading && !tickets ? <p>Loading…</p> : null}
        {tickets && tickets.length === 0 ? <p className="empty">Nothing here. Nice.</p> : null}

        <ul className="tickets">
          {tickets?.map((ticket) => (
            <li key={ticket.id}>
              <Link to={`/tickets/${ticket.id}`} className="ticket-row">
                <span className="ticket-main">
                  <span className="ticket-subject">{ticket.subject}</span>
                  <span className="ticket-meta">
                    #{ticket.id} · {ticket.customer.name ?? ticket.customer.email}
                    {ticket.customer.vip ? <span className="badge vip">VIP</span> : null}
                    {' · '}
                    {ticket.assignee ? ticket.assignee.name : 'Unassigned'}
                  </span>
                </span>
                <span className="ticket-tags">
                  {ticket.tags.map((t) => (
                    <TagChip key={t.id} tag={t} />
                  ))}
                </span>
                <PriorityBadge priority={ticket.priority} />
                <SlaBadge sla={ticket.sla} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
