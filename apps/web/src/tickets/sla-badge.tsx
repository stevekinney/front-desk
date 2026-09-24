import type { Sla } from '@front-desk/contract';

/** "3h 20m", "45m", "2d 1h" in business time (a business day is 8 hours). */
export function formatBusinessMinutes(total: number): string {
  const minutes = Math.abs(total);
  const days = Math.floor(minutes / 480);
  const hours = Math.floor((minutes % 480) / 60);
  const rest = minutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  return `${rest}m`;
}

export function slaLabel(sla: Sla): string {
  switch (sla.state) {
    case 'met':
      return 'SLA met';
    case 'missed':
      return 'SLA missed';
    case 'breached':
      // Past due, but no business time has gone by since (overnight, say).
      return sla.remainingMinutes
        ? `Overdue ${formatBusinessMinutes(sla.remainingMinutes)}`
        : 'Overdue';
    default:
      return `Due in ${formatBusinessMinutes(sla.remainingMinutes ?? 0)}`;
  }
}

export function SlaBadge({ sla }: { sla: Sla }) {
  return (
    <span
      className={`badge sla sla-${sla.state}`}
      title={`Due ${new Date(sla.dueAt).toLocaleString()} (business hours)`}
    >
      {slaLabel(sla)}
    </span>
  );
}
