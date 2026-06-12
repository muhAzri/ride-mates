/**
 * Request-shape validation (zod) for Listings (API_CONTRACT.md §6, §7). Create and
 * edit are `multipart/form-data` (photos travel inline), so the controller pulls
 * the *text* fields into a plain object and validates them here; photo files and
 * the `keepPhotoIds` reconcile set are validated in the use-case. Browse/saved
 * query strings are coerced and bounded here. Shape errors → 400.
 */
import { z } from 'zod';
import { normalizeLimit } from '@/shared/http/pagination';

const categoryEnum = z.enum(['bike', 'groupset', 'wheels', 'apparel', 'accessory', 'other']);
const conditionEnum = z.enum(['new', 'like_new', 'good', 'used']);

/** POST /listings text fields (MP-1). Photos are validated separately. */
export const createListingFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120, 'Title must be at most 120 characters.'),
  description: z.string().trim().max(4000, 'Description must be at most 4000 characters.').optional(),
  priceIdr: z.coerce
    .number({ message: 'Price is required.' })
    .int('Price must be a whole number of rupiah.')
    .min(0, 'Price cannot be negative.'),
  category: categoryEnum,
  condition: conditionEnum,
});

/** PATCH /listings/{id} text fields — all optional (MP-2, MP-8). */
export const updateListingFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  priceIdr: z.coerce.number().int().min(0).optional(),
  category: categoryEnum.optional(),
  condition: conditionEnum.optional(),
  status: z.enum(['active', 'sold', 'inactive']).optional(),
});

/**
 * GET /listings query params (MP-4/5/10/11). Everything arrives as strings, so we
 * coerce numbers and map the documented `radiusKm` enum (`all` → no cap). `limit`
 * is clamped to the contract bounds; `cursor` is decoded by the controller.
 */
export const browseQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  category: categoryEnum.optional(),
  condition: conditionEnum.optional(),
  minPriceIdr: z.coerce.number().int().min(0).optional(),
  maxPriceIdr: z.coerce.number().int().min(0).optional(),
  radiusKm: z.enum(['10', '25', '50', '100', 'all']).default('25'),
  exploreBeyond: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  sort: z.enum(['nearest', 'recent']).default('nearest'),
  // Browse exposes active/sold only; 'inactive' is owner-private (use the profile).
  status: z.enum(['active', 'sold']).default('active'),
  limit: z.coerce.number().int().optional().transform((v) => normalizeLimit(v)),
});

/** GET /me/saved/listings query params (§7). */
export const savedQuerySchema = z.object({
  limit: z.coerce.number().int().optional().transform((v) => normalizeLimit(v)),
});

export type CreateListingFields = z.infer<typeof createListingFieldsSchema>;
export type UpdateListingFieldsBody = z.infer<typeof updateListingFieldsSchema>;
export type BrowseQueryParams = z.infer<typeof browseQuerySchema>;
