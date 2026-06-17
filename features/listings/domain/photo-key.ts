/**
 * Listing-photo storage-key convention. Each photo gets its own immutable key
 * under the owner's folder (a listing keeps up to 3 photos, so they must not
 * overwrite one another). No file extension — content type is object metadata.
 *
 * Photos upload pre-signed (R17): the client first PUTs to a private *staging*
 * key, then create/edit promotes it to its public *final* key. Staging objects
 * live under `_staging/` so a bucket lifecycle rule can sweep abandoned uploads.
 */
import { STAGING_SEGMENT } from '@/shared/storage';

/** Folder that holds listing-photo objects in the bucket. */
export const LISTING_PHOTO_PREFIX = 'listings';

/** Per-photo final object key, namespaced by owner: `listings/{userId}/{uuid}`. */
export function listingPhotoKey(userId: string): string {
  return `${LISTING_PHOTO_PREFIX}/${userId}/${crypto.randomUUID()}`;
}

/**
 * Private staging key for a pending upload: `listings/_staging/{userId}/{ref}`.
 * The `ref` (a UUID issued at presign time and echoed back on commit) scopes the
 * object to its owner, so a caller can only commit their own staged uploads.
 */
export function listingPhotoStagingKey(userId: string, ref: string): string {
  return `${LISTING_PHOTO_PREFIX}/${STAGING_SEGMENT}/${userId}/${ref}`;
}
