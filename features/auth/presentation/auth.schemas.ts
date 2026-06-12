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

export const forgotPasswordSchema = z.object({
  email: z.email('A valid email is required.'),
});

export const resetPasswordSchema = z.object({
  email: z.email('A valid email is required.'),
  // The 6-digit recovery code from the reset email.
  token: z.string().min(1, 'token is required.'),
  // Shape only: strength (≥8, not all-numeric → 422) is PasswordPolicy's job.
  newPassword: z.string().min(1, 'newPassword is required.'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword is required.'),
  newPassword: z.string().min(1, 'newPassword is required.'),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type GoogleBody = z.infer<typeof googleSchema>;
export type RefreshBody = z.infer<typeof refreshSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
