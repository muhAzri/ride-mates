/**
 * UA-2 — authenticate an email/password account. Bad credentials surface as a
 * `401 UNAUTHENTICATED` from the data adapter (UA-2 acceptance).
 */
import type { AuthRepository } from '../domain/auth.repository';
import type { AuthResult, LoginCommand } from '../domain/auth.types';

export class LoginUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(command: LoginCommand): Promise<AuthResult> {
    const session = await this.repo.signInWithPassword(command);
    const snapshot = await this.repo.getAccountSnapshot(session);

    return { ...snapshot, tokens: session.tokens };
  }
}
