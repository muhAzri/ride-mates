/**
 * Request-shape validation (zod). Shape only — semantic rules like password
 * strength live in the domain (`PasswordPolicy`) and map to 422, while these map
 * to 400 VALIDATION_ERROR.
 */
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email('A valid email is required.'),
  // Shape check only: non-empty string. Strength (≥8, not all-numeric → 422)
  // is enforced by PasswordPolicy in the use-case.
  password: z.string().min(1, 'Password is required.'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required.')
    .max(60, 'Display name must be at most 60 characters.'),
});

export const loginSchema = z.object({
  email: z.email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const googleSchema = z.object({
  idToken: z.string().min(1, 'idToken is required.'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required.'),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type GoogleBody = z.infer<typeof googleSchema>;
export type RefreshBody = z.infer<typeof refreshSchema>;
