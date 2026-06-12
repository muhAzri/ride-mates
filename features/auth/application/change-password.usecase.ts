/**
 * UA-5 — change the authenticated user's password. The adapter verifies the
 * current password (wrong → 403) and applies the new one; we enforce strength
 * first (weak → 422), matching the contract's "403/422" outcomes (§3 change).
 */
import type { AuthRepository } from '../domain/auth.repository';
import type { ChangePasswordCommand } from '../domain/auth.types';
import { PasswordPolicy } from '../domain/password-policy';

export class ChangePasswordUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    PasswordPolicy.assertStrong(command.newPassword);
    await this.repo.changePassword(command);
  }
}
