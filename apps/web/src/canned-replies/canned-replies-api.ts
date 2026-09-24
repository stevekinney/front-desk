import type { CannedReply, Message } from '@front-desk/contract';

import { apiRequest } from '../api-client.ts';

export function listCannedReplies(): Promise<CannedReply[]> {
  return apiRequest<CannedReply[]>('/canned-replies');
}

export function sendCannedReply(
  ticketId: number,
  cannedReplyId: number,
  teammateId: number,
): Promise<Message> {
  return apiRequest<Message>(`/tickets/${ticketId}/canned-replies/${cannedReplyId}`, {
    method: 'POST',
    body: { teammateId },
  });
}
