/**
 * POST /listings/photo-upload-urls (MP-1 / R17) — issue pre-signed PUTs so the
 * client uploads listing photos **straight to object storage**, keeping the (up
 * to 3 × 8 MB) bytes off the API server. Used by both create and edit.
 *
 * Each URL targets a private *staging* key; the returned `ref` is echoed back on
 * POST/PATCH /listings, where the object is validated and promoted to its final
 * public key (`commitStagedImage`). Abandoned staging objects are swept by a
 * bucket lifecycle rule, so an unfinished form leaves no orphan.
 */
import { ApiError } from '@/shared/http/api-error';
import type { ObjectStorage, PresignedUpload } from '@/shared/storage';
import { assertAllowedImageType, LISTING_PHOTO_MAX_BYTES } from '@/shared/storage';
import type { ListingsRepository } from '../domain/listings.repository';
import { MAX_LISTING_PHOTOS } from '../domain/listing.constants';
import { listingPhotoStagingKey } from '../domain/photo-key';

/** Signed URLs are one-shot; a short window is enough for an immediate upload. */
const UPLOAD_TTL_SECONDS = 300;

export interface PhotoUploadUrl extends PresignedUpload {
  /** Opaque ref to echo back on create/edit so the server finds this upload. */
  ref: string;
}

export interface IssuePhotoUploadUrlsResult {
  uploads: PhotoUploadUrl[];
  /** Max bytes the commit step accepts per photo, so the client can pre-check. */
  maxBytes: number;
}

export class IssuePhotoUploadUrlsUseCase {
  constructor(
    private readonly repo: ListingsRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(
    accessToken: string,
    contentTypes: string[],
  ): Promise<IssuePhotoUploadUrlsResult> {
    if (contentTypes.length < 1) {
      throw ApiError.unprocessable('Request at least one photo upload.', {
        items: 'Add at least one photo.',
      });
    }
    if (contentTypes.length > MAX_LISTING_PHOTOS) {
      throw ApiError.unprocessable(
        `A listing can have at most ${MAX_LISTING_PHOTOS} photos.`,
        { items: `Request ${MAX_LISTING_PHOTOS} uploads or fewer.` },
      );
    }
    contentTypes.forEach((type) => assertAllowedImageType(type));

    const { id: userId } = await this.repo.getViewer(accessToken);

    const uploads = await Promise.all(
      contentTypes.map(async () => {
        const ref = crypto.randomUUID();
        const presigned = await this.storage.presignPut({
          key: listingPhotoStagingKey(userId, ref),
          expiresInSeconds: UPLOAD_TTL_SECONDS,
          public: false,
        });
        return { ref, ...presigned };
      }),
    );

    return { uploads, maxBytes: LISTING_PHOTO_MAX_BYTES };
  }
}
