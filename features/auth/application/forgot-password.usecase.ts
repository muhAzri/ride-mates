/**
 * UA-5 — request a password-reset email. Enforces the contract's no-enumeration
 * rule (§3 forgot: "Always 202 Accepted"): the caller must not be able to tell
 * whether the email is registered, so existence-revealing failures are swallowed
 * and the response is always success.
 *
 * Rate-limit errors are the exception: throttling is about request frequency, not
 * account existence, so it leaks nothing. We re-throw it as a 429 (with
 * Retry-After) so the client can tell the user to try again later.
 */
import { ApiError } from '@/shared/http/api-error';
import type { AuthRepository } from '../domain/auth.repository';

export class ForgotPasswordUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(email: string): Promise<void> {
    try {
      await this.repo.requestPasswordReset(email);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
        throw error; // surface 429 — safe and actionable.
      }
      // Never leak existence/availability of the account to the caller.
      console.error('[auth] password-reset request failed (suppressed)', error);
    }
  }
}
