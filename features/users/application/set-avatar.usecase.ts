/**
 * POST /users/me/avatar (UA-4) — validate, store, and record a new avatar.
 *
 * Orchestrates the two ports it needs: `ObjectStorage` (the bytes) and
 * `UsersRepository` (the URL on the profile). The storage key is the user's
 * single deterministic avatar key, so this *overwrites* any previous avatar —
 * no orphaned objects accumulate (the storage-thrift requirement). A
 * cache-busting `?v=` token makes the otherwise-stable URL refresh on clients.
 */
import type { ObjectStorage } from '@/shared/storage';
import { assertValidAvatar, type UploadedImage } from '@/shared/storage';
import type { UsersRepository } from '../domain/users.repository';
import { avatarKey, withCacheBust } from '../domain/avatar';

/** Avatars rarely change; cache hard and rely on the `?v=` token to bust. */
const AVATAR_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface SetAvatarResult {
  avatarUrl: string;
}

export class SetAvatarUseCase {
  constructor(
    private readonly repo: UsersRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(accessToken: string, image: UploadedImage): Promise<SetAvatarResult> {
    const contentType = assertValidAvatar(image);
    const { id: userId } = await this.repo.getIdentity(accessToken);

    const key = avatarKey(userId);
    const storedUrl = await this.storage.put({
      key,
      body: image.body,
      contentType,
      cacheControl: AVATAR_CACHE_CONTROL,
    });

    const avatarUrl = withCacheBust(storedUrl);
    await this.repo.setAvatarUrl(accessToken, avatarUrl);

    return { avatarUrl };
  }
}
