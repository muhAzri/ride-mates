/**
 * POST /listings (MP-1) — create a listing with its photos in one request. The
 * photo files arrive inline (multipart); this use-case validates and uploads them
 * to object storage, then persists the listing + photo URLs atomically via the
 * repository. If persistence fails, the just-uploaded objects are cleaned up so no
 * orphans are left (the single-endpoint guarantee). The listing inherits the
 * seller's pinned location server-side (FSD §7.2) — no coordinates are sent.
 */
import { ApiError } from '@/shared/http/api-error';
import type { ObjectStorage, UploadedImage } from '@/shared/storage';
import { assertValidListingPhoto } from '@/shared/storage';
import type { ListingsRepository } from '../domain/listings.repository';
import type { Listing, ListingPhotoInput } from '../domain/listing.types';
import { MAX_LISTING_PHOTOS } from '../domain/listing.constants';
import { listingPhotoKey } from '../domain/photo-key';

const PHOTO_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface CreateListingInput {
  title: string;
  description?: string;
  priceIdr: number;
  category: Listing['category'];
  condition: Listing['condition'];
  photos: UploadedImage[];
}

export class CreateListingUseCase {
  constructor(
    private readonly repo: ListingsRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(accessToken: string, input: CreateListingInput): Promise<Listing> {
    assertPhotoCount(input.photos.length);
    const { id: userId } = await this.repo.getViewer(accessToken);

    const uploaded = await uploadAll(this.storage, userId, input.photos);

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

/** Validate + upload each image; returns the persisted photo descriptors in order. */
export async function uploadAll(
  storage: ObjectStorage,
  userId: string,
  images: UploadedImage[],
): Promise<ListingPhotoInput[]> {
  const uploaded: ListingPhotoInput[] = [];
  try {
    for (const image of images) {
      const contentType = assertValidListingPhoto(image);
      const url = await storage.put({
        key: listingPhotoKey(userId),
        body: image.body,
        contentType,
        cacheControl: PHOTO_CACHE_CONTROL,
      });
      uploaded.push({ url, width: null, height: null });
    }
    return uploaded;
  } catch (error) {
    // One bad image shouldn't leave the earlier ones orphaned.
    await cleanup(storage, uploaded);
    throw error;
  }
}

/** Best-effort removal of uploaded objects (cleanup path — never masks the cause). */
export async function cleanup(storage: ObjectStorage, photos: ListingPhotoInput[]): Promise<void> {
  await Promise.all(
    photos.map((p) =>
      storage.removeByUrl(p.url).catch((e) => console.error('[listings] photo cleanup failed', e)),
    ),
  );
}
