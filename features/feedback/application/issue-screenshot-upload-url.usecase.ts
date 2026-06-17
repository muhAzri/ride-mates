/**
 * POST /feedback/screenshot-upload-url (FB-2 / R17) — issue a pre-signed PUT so an
 * optional feedback screenshot uploads straight to object storage, off the API
 * server. The returned `ref` is echoed back on POST /feedback, where the object
 * is validated and promoted to its final public key (`commitStagedImage`). An
 * abandoned upload is swept by the bucket lifecycle rule.
 */
import type { ObjectStorage, PresignedUpload } from '@/shared/storage';
import { assertAllowedImageType, AVATAR_MAX_BYTES } from '@/shared/storage';
import type { FeedbackRepository } from '../domain/feedback.repository';
import { screenshotStagingKey } from '../domain/screenshot-key';

/** Signed URLs are one-shot; a short window is enough for an immediate upload. */
const UPLOAD_TTL_SECONDS = 300;

export interface IssueScreenshotUploadUrlResult extends PresignedUpload {
  /** Opaque ref to echo back on POST /feedback so the server finds this upload. */
  ref: string;
  /** Max bytes the commit step will accept, so the client can pre-check. */
  maxBytes: number;
}

export class IssueScreenshotUploadUrlUseCase {
  constructor(
    private readonly repo: FeedbackRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(
    accessToken: string,
    contentType: string,
  ): Promise<IssueScreenshotUploadUrlResult> {
    assertAllowedImageType(contentType);
    const userId = await this.repo.getUserId(accessToken);

    const ref = crypto.randomUUID();
    const presigned = await this.storage.presignPut({
      key: screenshotStagingKey(userId, ref),
      expiresInSeconds: UPLOAD_TTL_SECONDS,
      public: false,
    });

    return { ref, ...presigned, maxBytes: AVATAR_MAX_BYTES };
  }
}
