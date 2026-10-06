import type { Tag, TagInput, TagWithCount, TicketStatus } from '@front-desk/contract';

import { apiRequest } from '../api-client.ts';

export function listTags(status?: TicketStatus): Promise<TagWithCount[]> {
  return apiRequest<TagWithCount[]>(status ? `/tags?status=${status}` : '/tags');
}

export function createTag(input: TagInput): Promise<Tag> {
  return apiRequest<Tag>('/tags', { method: 'POST', body: input });
}

export function addTagToTicket(ticketId: number, tagId: number): Promise<Tag[]> {
  return apiRequest<Tag[]>(`/tickets/${ticketId}/tags/${tagId}`, { method: 'PUT' });
}

export function removeTagFromTicket(ticketId: number, tagId: number): Promise<Tag[]> {
  return apiRequest<Tag[]>(`/tickets/${ticketId}/tags/${tagId}`, { method: 'DELETE' });
}
