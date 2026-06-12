/**
 * UA-2 — exchange a refresh token for a rotated session. Revoked/expired tokens
 * surface as `401` from the adapter.
 */
import type { AuthRepository } from '../domain/auth.repository';
import type { AuthTokens } from '../domain/auth.types';

export class RefreshSessionUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(refreshToken: string): Promise<AuthTokens> {
    return this.repo.refreshSession(refreshToken);
  }
}
