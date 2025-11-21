import { z } from 'zod';

export const tagInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(32),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, 'Color must be a hex value like #2f855a')
    .default('#4a5568'),
});

export type TagInput = z.infer<typeof tagInputSchema>;
