/**
 * Password strength rule (UA-1, API_CONTRACT.md §3 register): "min strength
 * enforced server-side (≥8 chars, not all-numeric); 422 if weak".
 *
 * This is a *semantic* rule, distinct from request-shape validation — a weak
 * password is well-formed but unacceptable, so it maps to 422 UNPROCESSABLE,
 * not 400. Keeping it in the domain makes the rule testable and reusable
 * (register today, password reset/change later).
 */
import { ApiError } from '@/shared/http/api-error';

export const MIN_PASSWORD_LENGTH = 8;

export const PasswordPolicy = {
  isStrong(password: string): boolean {
    return password.length >= MIN_PASSWORD_LENGTH && !/^\d+$/.test(password);
  },

  /** Throw `422 UNPROCESSABLE` when the password fails the policy. */
  assertStrong(password: string): void {
    if (this.isStrong(password)) return;
    throw ApiError.unprocessable('Password does not meet the minimum strength.', {
      password: `Use at least ${MIN_PASSWORD_LENGTH} characters and not only numbers.`,
    });
  },
};
