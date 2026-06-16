/**
 * Request-shape validation (zod) for Users & profile (API_CONTRACT.md §4).
 * Shape only — bytes/size/type of the avatar are validated in the storage layer
 * (`assertValidAvatar`), and routing-id presence is checked in the controller.
 */
import { z } from 'zod';

const CYCLING_TYPES = ['road', 'mtb', 'gravel', 'folding', 'casual'] as const;

/**
 * PATCH /users/me — every field optional (partial update), but at least one must
 * be present so an empty body is a clear 400 rather than a silent no-op (UA-3).
 */
export const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name is required.')
      .max(60, 'Display name must be at most 60 characters.'),
    // Nullable: clients may clear the bio.
    bio: z
      .string()
      .trim()
      .max(400, 'Bio must be at most 400 characters.')
      .nullable(),
    cyclingType: z.enum(CYCLING_TYPES, {
      message: 'Choose a valid cycling type.',
    }),
    // MVP default & only allowed value (API_CONTRACT.md §16 / contactPreference).
    contactPreference: z.literal('in_app_chat', {
      message: 'Unsupported contact preference.',
    }),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;

/**
 * POST /users/me/avatar/upload-url — the client declares the image's content type
 * so the server can pre-validate it before issuing a pre-signed upload URL (UA-4,
 * R16). Whether the type is *allowed* (WebP/JPEG/PNG) is asserted in the storage
 * layer (`assertAllowedImageType`); here we only require a non-empty string.
 */
export const avatarUploadUrlSchema = z.object({
  contentType: z
    .string()
    .trim()
    .min(1, 'Provide the image content type, e.g. "image/webp".'),
});

export type AvatarUploadUrlBody = z.infer<typeof avatarUploadUrlSchema>;

/**
 * PATCH /me/notification-preferences — partial; at least one toggle required so
 * an empty body is a clear 400 rather than a silent no-op (§14).
 */
export const updateNotificationPreferencesSchema = z
  .object({
    newMessages: z.boolean(),
    threadReplies: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one preference to update.',
  });

export type UpdateNotificationPreferencesBody = z.infer<
  typeof updateNotificationPreferencesSchema
>;
