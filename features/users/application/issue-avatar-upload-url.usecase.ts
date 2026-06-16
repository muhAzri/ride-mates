/**
 * POST /users/me/avatar/upload-url (UA-4, step 1) — hand the client a pre-signed
 * URL so it uploads the avatar **directly to object storage**, never streaming the
 * bytes through the API server (bandwidth-thrift — see API_CONTRACT.md R16).
 *
 * The key is the user's single deterministic avatar key, so the eventual upload
 * *overwrites* any previous avatar — no orphaned objects accumulate. Size can't be
 * enforced at signing time; the commit step (`CommitAvatarUseCase`) validates the
 * uploaded object via a metadata `head` before recording it.
 */
import type { ObjectStorage, PresignedUpload } from '@/shared/storage';
import { assertAllowedImageType, AVATAR_MAX_BYTES } from '@/shared/storage';
import type { UsersRepository } from '../domain/users.repository';
import { avatarKey } from '../domain/avatar';

/** Signed URLs are one-shot; a short window is enough for an immediate upload. */
const AVATAR_UPLOAD_TTL_SECONDS = 120;

export interface IssueAvatarUploadUrlResult extends PresignedUpload {
  /** Max bytes the commit step will accept, so the client can pre-check. */
  maxBytes: number;
}

export class IssueAvatarUploadUrlUseCase {
  constructor(
    private readonly repo: UsersRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(
    accessToken: string,
    contentType: string,
  ): Promise<IssueAvatarUploadUrlResult> {
    // Reject obviously-wrong types up front; the byte-level guard runs on commit.
    assertAllowedImageType(contentType);
    const { id: userId } = await this.repo.getIdentity(accessToken);

    const presigned = await this.storage.presignPut({
      key: avatarKey(userId),
      expiresInSeconds: AVATAR_UPLOAD_TTL_SECONDS,
    });

    return { ...presigned, maxBytes: AVATAR_MAX_BYTES };
  }
}
