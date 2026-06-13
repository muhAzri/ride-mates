/**
 * Request-shape validation (zod) for the forum (API_CONTRACT.md §8, §9). Shape
 * only → 400 VALIDATION_ERROR. Query strings are coerced/bounded; bodies match
 * the DB length checks (title ≤160, body ≤8000, comment ≤4000).
 */
import { z } from 'zod';
import { normalizeLimit } from '@/shared/http/pagination';

const categoryEnum = z.enum(['rides', 'tech', 'gear', 'general']);

/** POST /threads (CF-1). */
export const createThreadSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(160, 'Title must be at most 160 characters.'),
  body: z.string().trim().min(1, 'Body is required.').max(8000, 'Body must be at most 8000 characters.'),
  category: categoryEnum.optional(),
});

/** POST /threads/{id}/comments (CF-2). */
export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty.').max(4000, 'Comment must be at most 4000 characters.'),
});

/** GET /threads query params (CF-1/4/5). */
export const threadQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  category: categoryEnum.optional(),
  sort: z.enum(['latest', 'top']).default('latest'),
  limit: z.coerce.number().int().optional().transform((v) => normalizeLimit(v)),
});

/** GET /threads/{id}/comments and GET /me/saved/threads query params. */
export const listQuerySchema = z.object({
  limit: z.coerce.number().int().optional().transform((v) => normalizeLimit(v)),
});

export type CreateThreadBody = z.infer<typeof createThreadSchema>;
export type CreateCommentBody = z.infer<typeof createCommentSchema>;
export type ThreadQueryParams = z.infer<typeof threadQuerySchema>;
