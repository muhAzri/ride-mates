/**
 * Request-shape validation (zod) for the admin moderation queue (API_CONTRACT.md
 * §15). Shape only → 400. `status` defaults to the live queue (`queued`).
 */
import { z } from 'zod';
import { normalizeLimit } from '@/shared/http/pagination';

export const adminReportsQuerySchema = z.object({
  status: z.enum(['queued', 'resolved', 'dismissed']).default('queued'),
  targetType: z.enum(['user', 'listing', 'thread', 'comment']).optional(),
  limit: z.coerce.number().int().optional().transform((v) => normalizeLimit(v)),
});

export const resolveReportSchema = z.object({
  action: z.enum(['remove_content', 'dismiss', 'warn_user']),
  note: z.string().trim().max(2000, 'Note must be at most 2000 characters.').optional(),
});

export type ResolveReportBody = z.infer<typeof resolveReportSchema>;
