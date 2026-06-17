/**
 * Request-shape validation (zod) for Listings (API_CONTRACT.md §6, §7). Create and
 * edit are now `application/json`: photos upload pre-signed (R17), so the body
 * carries `photoRefs` (refs for objects already PUT to staging) rather than file
 * parts. The photo *count*, ref format and object validity are checked in the
 * use-case. Browse/saved query strings are coerced and bounded here. Shape
 * errors → 400.
 */
import { z } from 'zod';
import { normalizeLimit } from '@/shared/http/pagination';

const categoryEnum = z.enum(['bike', 'groupset', 'wheels', 'apparel', 'accessory', 'other']);
const conditionEnum = z.enum(['new', 'like_new', 'good', 'used']);

/**
 * POST /listings/photo-upload-urls (MP-1 / R17). One content type per photo the
 * client intends to upload; whether each type is allowed is asserted in the
 * use-case (`assertAllowedImageType`).
 */
export const photoUploadUrlsSchema = z.object({
  contentTypes: z
    .array(z.string().trim().min(1, 'Provide each image content type.'))
    .min(1, 'Request at least one photo upload.'),
});

/** POST /listings body (MP-1). `photoRefs` come from photo-upload-urls. */
export const createListingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120, 'Title must be at most 120 characters.'),
  description: z.string().trim().max(4000, 'Description must be at most 4000 characters.').optional(),
  priceIdr: z.coerce
    .number({ message: 'Price is required.' })
    .int('Price must be a whole number of rupiah.')
    .min(0, 'Price cannot be negative.'),
  category: categoryEnum,
  condition: conditionEnum,
  photoRefs: z.array(z.string()).default([]),
});

/** PATCH /listings/{id} body — all optional (MP-2, MP-8). */
export const updateListingSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  priceIdr: z.coerce.number().int().min(0).optional(),
  category: categoryEnum.optional(),
  condition: conditionEnum.optional(),
  status: z.enum(['active', 'sold', 'inactive']).optional(),
  /** Ids of existing photos to keep; presence means "reconcile photos". */
  keepPhotoIds: z.array(z.string()).optional(),
  /** Refs of newly pre-signed-uploaded photos to add. */
  photoRefs: z.array(z.string()).optional(),
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

export type CreateListingBody = z.infer<typeof createListingSchema>;
export type UpdateListingBody = z.infer<typeof updateListingSchema>;
export type PhotoUploadUrlsBody = z.infer<typeof photoUploadUrlsSchema>;
export type BrowseQueryParams = z.infer<typeof browseQuerySchema>;
