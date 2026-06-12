/**
 * Request-shape validation (zod) for device registration (API_CONTRACT.md §11).
 * Shape only → 400 VALIDATION_ERROR.
 */
import { z } from 'zod';

export const registerDeviceSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'Device token is required.')
    .max(4096, 'Device token is too long.'),
  platform: z.enum(['android', 'ios', 'web']),
});

export type RegisterDeviceBody = z.infer<typeof registerDeviceSchema>;
