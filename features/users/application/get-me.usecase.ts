/**
 * GET /users/me (UA-3) — return the caller's own full profile projection.
 */
import type { UsersRepository } from '../domain/users.repository';
import type { SelfProfile } from '../domain/user.types';

export class GetMeUseCase {
  constructor(private readonly repo: UsersRepository) {}

  execute(accessToken: string): Promise<SelfProfile> {
    return this.repo.getSelf(accessToken);
  }
}
