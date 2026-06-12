/**
 * PATCH /users/me (UA-3) — apply a partial profile update (owner-only) and
 * return the refreshed self projection. Field shape is validated at the HTTP
 * boundary; this use-case just orchestrates the persist + read-back.
 */
import type { UsersRepository } from '../domain/users.repository';
import type { SelfProfile, UpdateProfileCommand } from '../domain/user.types';

export class UpdateProfileUseCase {
  constructor(private readonly repo: UsersRepository) {}

  execute(accessToken: string, command: UpdateProfileCommand): Promise<SelfProfile> {
    return this.repo.updateProfile(accessToken, command);
  }
}
