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
