// Shows a ticket's priority in the inbox, but only when it is worth interrupting the eye.
import type { TicketPriority } from '@front-desk/contract';

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  if (priority !== 'high' && priority !== 'urgent') return null;
  return <span className={`badge priority priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>;
}
