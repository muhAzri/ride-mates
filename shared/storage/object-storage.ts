/**
 * Object-storage port (Dependency Inversion). Feature use-cases depend on this
 * interface, never on the concrete S3 client — swapping providers means writing
 * a new adapter and nothing else.
 *
 * Keying convention lives in the *callers* (e.g. the avatar use-case owns
 * `avatars/{userId}`), so this port stays a generic blob store usable by avatars,
 * listing photos, and feedback screenshots alike.
 */

export interface PutObjectInput {
  /** Full object key, e.g. `avatars/usr_01J...`. */
  key: string;
  body: Buffer;
  contentType: string;
  /** Cache-Control header to store on the object. */
  cacheControl?: string;
}

export interface ObjectStorage {
  /**
   * Upload (overwrite) an object, served `public-read`. Returns the public URL.
   * Overwriting reuses the same key, so a per-user key never accumulates orphans.
   */
  put(input: PutObjectInput): Promise<string>;

  /** Delete an object. Idempotent: a missing key is treated as success. */
  remove(key: string): Promise<void>;

  /**
   * Delete an object given its public URL (the inverse of `publicUrl`). Used when
   * the caller stored URLs (e.g. `listing_photos.url`) and needs to clean them up.
   * A URL not served by this store is ignored.
   */
  removeByUrl(url: string): Promise<void>;

  /** Public URL an object key is served from (no cache-busting query). */
  publicUrl(key: string): string;
}
