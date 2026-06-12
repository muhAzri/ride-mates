/**
 * UA-5 — set a new password using a recovery token from the reset email.
 * Enforces the password policy (≥8, not all-numeric → 422) before consuming the
 * token.
 */
import type { AuthRepository } from '../domain/auth.repository';
import type { ResetPasswordCommand } from '../domain/auth.types';
import { PasswordPolicy } from '../domain/password-policy';

export class ResetPasswordUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    PasswordPolicy.assertStrong(command.newPassword);
    await this.repo.resetPassword(command);
  }
}
