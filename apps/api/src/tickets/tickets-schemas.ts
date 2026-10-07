import { z } from 'zod';

import { TICKET_PRIORITIES, TICKET_STATUSES } from '@front-desk/contract';

export const ticketStatusSchema = z.enum(TICKET_STATUSES);

export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);

export const listTicketsQuerySchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  tag: z.string().trim().min(1).optional(),
  assigneeId: z.coerce.number().int().positive().optional(),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

export const updateStatusSchema = z.object({
  status: ticketStatusSchema,
});

export const updatePrioritySchema = z.object({
  priority: ticketPrioritySchema,
});

export const assignSchema = z.object({
  teammateId: z.number().int().positive().nullable(),
});

export const replySchema = z.object({
  teammateId: z.number().int().positive(),
  body: z.string().trim().min(1, 'Reply cannot be empty').max(10_000),
});
