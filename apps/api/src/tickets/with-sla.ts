import type { Ticket } from '@front-desk/contract';

import { getSla } from '../legacy-adapter.ts';
import type { TicketRecord } from './tickets-repository.ts';

/** Attach the mailroom's SLA summary to a ticket. */
export async function withSla<T extends TicketRecord>(record: T): Promise<T & Pick<Ticket, 'sla'>> {
  const summary = await getSla(record.id);
  if (!summary) throw new Error(`No SLA for ticket ${record.id}`);
  return {
    ...record,
    sla: {
      dueAt: summary.dueAt,
      state: summary.state,
      remainingMinutes: summary.remainingMinutes,
    },
  };
}
