/**
 * UA-5 — request a password-reset email. Enforces the contract's no-enumeration
 * rule (§3 forgot: "Always 202 Accepted"): the caller can never tell whether the
 * email is registered, so provider failures are swallowed (and logged) rather
 * than surfaced. The outcome is always success from the client's perspective.
 */
import type { AuthRepository } from '../domain/auth.repository';

export class ForgotPasswordUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(email: string): Promise<void> {
    try {
      await this.repo.requestPasswordReset(email);
    } catch (error) {
      // Never leak existence/availability of the account to the caller.
      console.error('[auth] password-reset request failed (suppressed)', error);
    }
  }
}
