/**
 * UA-2 — log out by revoking the session behind the caller's access token.
 */
import type { AuthRepository } from '../domain/auth.repository';

export class LogoutUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(accessToken: string): Promise<void> {
    await this.repo.revokeSession(accessToken);
  }
}
