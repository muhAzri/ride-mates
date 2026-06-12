/**
 * Listing-photo storage-key convention. Each photo gets its own immutable key
 * under the owner's folder (a listing keeps up to 3 photos, so they must not
 * overwrite one another). No file extension — content type is object metadata.
 */

/** Folder that holds listing-photo objects in the bucket. */
export const LISTING_PHOTO_PREFIX = 'listings';

/** Per-photo object key, namespaced by owner: `listings/{userId}/{uuid}`. */
export function listingPhotoKey(userId: string): string {
  return `${LISTING_PHOTO_PREFIX}/${userId}/${crypto.randomUUID()}`;
}
