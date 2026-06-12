/**
 * UA-1 — register an email/password account, returning the user, their session
 * tokens, and onboarding flags. Orchestrates the domain rule (password policy)
 * and the data port; knows nothing about HTTP or Supabase.
 */
import type { AuthRepository } from '../domain/auth.repository';
import type { AuthResult, RegisterCommand } from '../domain/auth.types';
import { PasswordPolicy } from '../domain/password-policy';

export class RegisterUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(command: RegisterCommand): Promise<AuthResult> {
    PasswordPolicy.assertStrong(command.password);

    const session = await this.repo.signUpWithPassword(command);
    const snapshot = await this.repo.getAccountSnapshot(session);

    return { ...snapshot, tokens: session.tokens };
  }
}
