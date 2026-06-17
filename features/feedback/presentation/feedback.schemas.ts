/**
 * Request-shape validation (zod) for feedback / feature requests (API_CONTRACT.md
 * §13). Shape only → 400. POST /feedback is `application/json`: an optional
 * screenshot uploads pre-signed (R17), so the body carries a `screenshotRef`
 * (validated in the use-case) rather than a file part.
 */
import { z } from 'zod';
import { normalizeLimit } from '@/shared/http/pagination';

export const feedbackSchema = z.object({
  type: z.enum(['bug', 'idea', 'other']),
  message: z.string().trim().min(1, 'A message is required.').max(4000, 'Message must be at most 4000 characters.'),
  includeAppInfo: z.boolean().optional().default(false),
  appVersion: z.string().trim().max(50).optional(),
  platform: z.string().trim().max(50).optional(),
  osVersion: z.string().trim().max(50).optional(),
  deviceModel: z.string().trim().max(100).optional(),
  /** Ref of a pre-signed-uploaded screenshot to attach (optional). */
  screenshotRef: z.string().trim().min(1).optional(),
});

/**
 * POST /feedback/screenshot-upload-url (FB-2 / R17). The client declares the
 * screenshot's content type; whether it is allowed is asserted in the use-case.
 */
export const screenshotUploadUrlSchema = z.object({
  contentType: z.string().trim().min(1, 'Provide the image content type, e.g. "image/webp".'),
});

export const createFeatureRequestSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(160, 'Title must be at most 160 characters.'),
  description: z.string().trim().max(2000, 'Description must be at most 2000 characters.').optional(),
});

export const featureRequestQuerySchema = z.object({
  sort: z.enum(['top', 'new']).default('top'),
  limit: z.coerce.number().int().optional().transform((v) => normalizeLimit(v)),
});

export type FeedbackBody = z.infer<typeof feedbackSchema>;
export type CreateFeatureRequestBody = z.infer<typeof createFeatureRequestSchema>;
