/**
 * PATCH /listings/{id} (MP-2, MP-8) — owner-only edit, photos in the same request.
 * Authorization is explicit: missing/hidden → `404`, someone else's → `403`
 * (admins may also edit, for moderation).
 *
 * Photo reconcile (when the client sends `keepPhotoIds` and/or new `photos`): the
 * use-case diffs the request against the listing's current photos — photos absent
 * from the keep-set are deleted (DB row + stored object), new files are uploaded
 * and appended. The result must keep 1–3 photos. When neither is sent, photos are
 * left untouched.
 */
import { ApiError } from '@/shared/http/api-error';
import type { ObjectStorage, UploadedImage } from '@/shared/storage';
import type { ListingsRepository } from '../domain/listings.repository';
import type { Listing, UpdateListingFields } from '../domain/listing.types';
import { assertPhotoCount, cleanup, uploadAll } from './create-listing.usecase';

/** What the client expressed about photos in a PATCH (parsed by the controller). */
export interface PhotoEditIntent {
  /** True when `keepPhotoIds` and/or new `photos` were present (i.e. reconcile). */
  touched: boolean;
  /** True when the `keepPhotoIds` part was sent at all (even empty). */
  keepProvided: boolean;
  /** Ids of existing photos to retain. */
  keepIds: string[];
  /** New image files to add. */
  newFiles: UploadedImage[];
}

export class UpdateListingUseCase {
  constructor(
    private readonly repo: ListingsRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(
    accessToken: string,
    listingId: string,
    fields: UpdateListingFields,
    photos: PhotoEditIntent,
  ): Promise<Listing> {
    const hasFieldChange = Object.keys(fields).length > 0;
    if (!hasFieldChange && !photos.touched) {
      throw ApiError.validation('Nothing to update.', {
        _root: 'Provide at least one field or photo change.',
      });
    }

    const viewer = await this.repo.getViewer(accessToken);
    const ownership = await this.repo.getOwnership(accessToken, listingId);
    if (!ownership) {
      throw ApiError.notFound('Listing not found.');
    }
    if (ownership.ownerId !== viewer.id && !viewer.isAdmin) {
      throw ApiError.forbidden('You can only edit your own listings.');
    }

    if (hasFieldChange) {
      await this.repo.updateFields(accessToken, listingId, fields);
    }

    if (photos.touched) {
      await this.reconcile(accessToken, listingId, viewer.id, photos);
    }

    const { listing } = await this.repo.getDetail(accessToken, listingId);
    if (!listing) {
      console.error('[listings] edited listing not readable', listingId);
      throw ApiError.internal();
    }
    return listing;
  }

  private async reconcile(
    accessToken: string,
    listingId: string,
    userId: string,
    photos: PhotoEditIntent,
  ): Promise<void> {
    const current = await this.repo.getPhotos(accessToken, listingId);
    const currentIds = new Set(current.map((p) => p.id));

    // An unknown keep-id is a client mistake — reject before touching anything.
    for (const id of photos.keepIds) {
      if (!currentIds.has(id)) {
        throw ApiError.unprocessable('A kept photo does not belong to this listing.', {
          keepPhotoIds: 'Send ids from this listing\'s current photos.',
        });
      }
    }

    // Omitting keepPhotoIds entirely means "keep all current" (pure addition).
    const keepSet = photos.keepProvided ? new Set(photos.keepIds) : currentIds;
    const kept = current.filter((p) => keepSet.has(p.id));
    const toDelete = current.filter((p) => !keepSet.has(p.id));

    assertPhotoCount(kept.length + photos.newFiles.length);

    const uploaded = await uploadAll(this.storage, userId, photos.newFiles);
    const startPosition = kept.length > 0 ? Math.max(...kept.map((p) => p.position)) + 1 : 0;

    try {
      await this.repo.reconcilePhotos(
        accessToken,
        listingId,
        toDelete.map((p) => p.id),
        uploaded,
        startPosition,
      );
    } catch (error) {
      await cleanup(this.storage, uploaded);
      throw error;
    }

    // DB reconcile committed — drop the removed objects from the bucket (best effort).
    await cleanup(
      this.storage,
      toDelete.map((p) => ({ url: p.url, width: null, height: null })),
    );
  }
}
