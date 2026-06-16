/**
 * PUT /users/me/avatar (UA-4, step 2) — confirm a pre-signed upload and record it.
 *
 * The client has already uploaded the bytes straight to the bucket (step 1 issued
 * the URL). Here we read only the object's *metadata* (`head`) — no bytes flow
 * through the server — to enforce the size/type guard that the pre-signed PUT
 * could not. An invalid object is deleted so a rejected upload leaves nothing
 * behind. On success we stamp a cache-busting `?v=` token (the key is stable
 * across changes) and persist the URL on the profile.
 */
import type { ObjectStorage } from '@/shared/storage';
import { assertValidAvatarMeta } from '@/shared/storage';
import { ApiError } from '@/shared/http/api-error';
import type { UsersRepository } from '../domain/users.repository';
import { avatarKey, withCacheBust } from '../domain/avatar';

export interface CommitAvatarResult {
  avatarUrl: string;
}

export class CommitAvatarUseCase {
  constructor(
    private readonly repo: UsersRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(accessToken: string): Promise<CommitAvatarResult> {
    const { id: userId } = await this.repo.getIdentity(accessToken);
    const key = avatarKey(userId);

    const meta = await this.storage.head(key);
    if (!meta) {
      throw ApiError.unprocessable('No uploaded avatar was found to confirm.', {
        file: 'Upload the image before confirming, then try again.',
      });
    }

    try {
      assertValidAvatarMeta({ size: meta.contentLength, contentType: meta.contentType });
    } catch (error) {
      // Reject and clean up: a too-large / wrong-type object must not linger.
      await this.storage.remove(key);
      throw error;
    }

    const avatarUrl = withCacheBust(this.storage.publicUrl(key));
    await this.repo.setAvatarUrl(accessToken, avatarUrl);

    return { avatarUrl };
  }
}
