import type { Message, ReplyInput, Ticket, TicketDetail, TicketStatus } from '@front-desk/contract';

import { apiRequest } from '../api-client.ts';

export interface TicketFilters {
  status?: TicketStatus;
  tag?: string;
}

export function listTickets(filters: TicketFilters = {}): Promise<Ticket[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.tag) params.set('tag', filters.tag);
  const query = params.toString();
  return apiRequest<Ticket[]>(`/tickets${query ? `?${query}` : ''}`);
}

export function getTicket(id: number): Promise<TicketDetail> {
  return apiRequest<TicketDetail>(`/tickets/${id}`);
}

export function updateStatus(id: number, status: TicketStatus): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}/status`, { method: 'PATCH', body: { status } });
}

export function assignTicket(id: number, teammateId: number | null): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}/assignee`, { method: 'PUT', body: { teammateId } });
}

export function replyToTicket(id: number, reply: ReplyInput): Promise<Message> {
  return apiRequest<Message>(`/tickets/${id}/replies`, { method: 'POST', body: reply });
}
