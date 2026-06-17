/**
 * POST /listings (MP-1) — create a listing with its photos. Photos are uploaded
 * pre-signed (R17): the client sends `photoRefs` for objects it already PUT to
 * staging, and this use-case validates + promotes each to its final public key,
 * then persists the listing + photo URLs atomically. If persistence fails, the
 * promoted objects are cleaned up so no orphans are left. The listing inherits
 * the seller's pinned location server-side (FSD §7.2) — no coordinates are sent.
 */
import { ApiError } from '@/shared/http/api-error';
import type { ObjectStorage } from '@/shared/storage';
import {
  assertValidListingPhotoMeta,
  commitStagedImage,
  isUploadRef,
} from '@/shared/storage';
import type { ListingsRepository } from '../domain/listings.repository';
import type { Listing, ListingPhotoInput } from '../domain/listing.types';
import { MAX_LISTING_PHOTOS } from '../domain/listing.constants';
import { listingPhotoKey, listingPhotoStagingKey } from '../domain/photo-key';

const PHOTO_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface CreateListingInput {
  title: string;
  description?: string;
  priceIdr: number;
  category: Listing['category'];
  condition: Listing['condition'];
  photoRefs: string[];
}

export class CreateListingUseCase {
  constructor(
    private readonly repo: ListingsRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(accessToken: string, input: CreateListingInput): Promise<Listing> {
    assertPhotoCount(input.photoRefs.length);
    const { id: userId } = await this.repo.getViewer(accessToken);

    const uploaded = await commitPhotos(this.storage, userId, input.photoRefs);

    try {
      return await this.repo.create(accessToken, {
        title: input.title,
        description: input.description,
        priceIdr: input.priceIdr,
        category: input.category,
        condition: input.condition,
        photos: uploaded,
      });
    } catch (error) {
      await cleanup(this.storage, uploaded);
      throw error;
    }
  }
}

/** Shared: 1–3 photos required (MP-1 / O2). */
export function assertPhotoCount(count: number): void {
  if (count < 1) {
    throw ApiError.unprocessable('Add at least one photo.', { photos: 'A listing needs a photo.' });
  }
  if (count > MAX_LISTING_PHOTOS) {
    throw ApiError.unprocessable(`A listing can have at most ${MAX_LISTING_PHOTOS} photos.`, {
      photos: `Keep it to ${MAX_LISTING_PHOTOS} photos or fewer.`,
    });
  }
}

/**
 * Validate + promote each staged upload (by ref) to its final public key; returns
 * the persisted photo descriptors in order. A bad ref or a missing/invalid staged
 * object is rejected, and any earlier promoted objects are cleaned up first.
 */
export async function commitPhotos(
  storage: ObjectStorage,
  userId: string,
  refs: string[],
): Promise<ListingPhotoInput[]> {
  const uploaded: ListingPhotoInput[] = [];
  try {
    for (const ref of refs) {
      if (!isUploadRef(ref)) {
        throw ApiError.unprocessable('A photo upload reference is invalid.', {
          photos: 'Re-upload the photo and try again.',
        });
      }
      const url = await commitStagedImage(storage, {
        stagingKey: listingPhotoStagingKey(userId, ref),
        finalKey: listingPhotoKey(userId),
        validate: assertValidListingPhotoMeta,
        cacheControl: PHOTO_CACHE_CONTROL,
      });
      uploaded.push({ url, width: null, height: null });
    }
    return uploaded;
  } catch (error) {
    // One bad photo shouldn't leave the earlier ones orphaned.
    await cleanup(storage, uploaded);
    throw error;
  }
}

/** Best-effort removal of promoted objects (cleanup path — never masks the cause). */
export async function cleanup(storage: ObjectStorage, photos: ListingPhotoInput[]): Promise<void> {
  await Promise.all(
    photos.map((p) =>
      storage.removeByUrl(p.url).catch((e) => console.error('[listings] photo cleanup failed', e)),
    ),
  );
}
