/**
 * GET /users/{userId} (UA-3) — return another user's public projection: no
 * email, no role, no contact preference, and never coordinates (LP-1).
 */
import type { UsersRepository } from '../domain/users.repository';
import type { PublicProfile } from '../domain/user.types';

export class GetPublicProfileUseCase {
  constructor(private readonly repo: UsersRepository) {}

  execute(accessToken: string, userId: string): Promise<PublicProfile> {
    return this.repo.getPublicProfile(accessToken, userId);
  }
}
