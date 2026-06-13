/**
 * Request-shape validation (zod) for moderation (API_CONTRACT.md §12). Shape only
 * → 400. The DB also enforces "something_else needs details", but we validate it
 * here too so the client gets a clean per-field message.
 */
import { z } from 'zod';

export const createReportSchema = z
  .object({
    targetType: z.enum(['user', 'listing', 'thread', 'comment']),
    targetId: z.string().trim().min(1, 'Target id is required.'),
    reason: z.enum([
      'spam',
      'scam_or_fraud',
      'prohibited_item',
      'harassment',
      'inappropriate',
      'something_else',
    ]),
    details: z.string().trim().max(2000, 'Details must be at most 2000 characters.').optional(),
  })
  .refine((body) => body.reason !== 'something_else' || (body.details?.length ?? 0) > 0, {
    message: 'Please describe the problem.',
    path: ['details'],
  });

export type CreateReportBody = z.infer<typeof createReportSchema>;
