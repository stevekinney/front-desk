import { z } from 'zod';

export const cannedReplyInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(80),
  body: z.string().trim().min(1, 'Body is required').max(10_000),
});

export type CannedReplyInput = z.infer<typeof cannedReplyInputSchema>;

export const sendCannedReplySchema = z.object({
  teammateId: z.number().int().positive(),
});
