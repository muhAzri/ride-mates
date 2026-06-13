/**
 * Request-shape validation (zod) for messaging (API_CONTRACT.md §10). Shape only
 * → 400 VALIDATION_ERROR. Ids are uuids (§1.4); the message body matches the DB
 * length check (≤4000) and a send must carry text and/or a shared listing
 * (`messages_has_content`).
 */
import { z } from 'zod';
import { normalizeLimit } from '@/shared/http/pagination';

/** POST /conversations (MP-6, MS-1). */
export const openConversationSchema = z.object({
  recipientId: z.string().uuid('A valid recipient is required.'),
  listingRef: z.string().uuid('A valid listing reference is required.').optional(),
});

/** POST /conversations/{id}/messages (MS-2, MS-3). */
export const sendMessageSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'A message cannot be empty.')
      .max(4000, 'A message must be at most 4000 characters.')
      .optional(),
    listingRef: z.string().uuid('A valid listing reference is required.').optional(),
  })
  .refine((value) => value.body !== undefined || value.listingRef !== undefined, {
    message: 'Send a message or share a listing.',
  });

/** GET list query params (conversations & messages) — just the page size. */
export const listQuerySchema = z.object({
  limit: z.coerce.number().int().optional().transform((v) => normalizeLimit(v)),
});

export type OpenConversationBody = z.infer<typeof openConversationSchema>;
export type SendMessageBody = z.infer<typeof sendMessageSchema>;
