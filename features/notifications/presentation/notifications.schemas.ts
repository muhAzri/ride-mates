/**
 * Query-shape validation (zod) for notifications (API_CONTRACT.md §11). Shape
 * only → 400. `limit` is clamped to the contract bounds; `cursor` is decoded by
 * the controller.
 */
import { z } from 'zod';
import { normalizeLimit } from '@/shared/http/pagination';

export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().optional().transform((v) => normalizeLimit(v)),
});
