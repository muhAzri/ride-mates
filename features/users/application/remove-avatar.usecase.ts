/**
 * DELETE /users/me/avatar (UA-4) — remove the stored avatar object and clear the
 * URL on the profile. After this, `avatarUrl` is `null` and clients render the
 * default placeholder (UA-4 acceptance).
 *
 * The object is deleted first; the storage delete is idempotent (a missing key
 * is a success), so a repeated call or an already-empty avatar is harmless.
 */
import type { ObjectStorage } from '@/shared/storage';
import type { UsersRepository } from '../domain/users.repository';
import { avatarKey } from '../domain/avatar';

export class RemoveAvatarUseCase {
  constructor(
    private readonly repo: UsersRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(accessToken: string): Promise<void> {
    const { id: userId } = await this.repo.getIdentity(accessToken);
    await this.storage.remove(avatarKey(userId));
    await this.repo.setAvatarUrl(accessToken, null);
  }
}
