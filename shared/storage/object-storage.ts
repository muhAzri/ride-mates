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

export interface PresignPutInput {
  /** Full object key the client will upload to, e.g. `avatars/usr_01J...`. */
  key: string;
  /** Seconds the signed URL stays valid. Keep short — it's a one-shot upload. */
  expiresInSeconds: number;
}

export interface PresignedUpload {
  /** Pre-signed URL the client `PUT`s the bytes to (bypassing the API server). */
  uploadUrl: string;
  /** HTTP method to use (always `PUT` for this scheme). */
  method: 'PUT';
  /**
   * Headers the client **must** send verbatim, because they are part of the
   * signature (e.g. `x-amz-acl: public-read`). Omitting them fails the upload.
   */
  headers: Record<string, string>;
  /** When the signed URL stops working (ISO-8601), for client retry logic. */
  expiresAt: string;
}

export interface ObjectHead {
  /** Stored object size in bytes. */
  contentLength: number;
  /** Stored `Content-Type` (as set by the uploader), lower-cased, no params. */
  contentType: string;
}

export interface ObjectStorage {
  /**
   * Upload (overwrite) an object, served `public-read`. Returns the public URL.
   * Overwriting reuses the same key, so a per-user key never accumulates orphans.
   */
  put(input: PutObjectInput): Promise<string>;

  /**
   * Issue a pre-signed PUT so the client uploads bytes **directly** to the store,
   * keeping large payloads off the API server (bandwidth-thrift — matters on
   * metered hosts like Vercel). The object is signed `public-read`; the caller is
   * responsible for validating the result afterwards via `head` (size/type can't
   * be enforced at signing time). Overwrites the key, like `put`.
   */
  presignPut(input: PresignPutInput): Promise<PresignedUpload>;

  /**
   * Read an object's metadata (size + content type) without downloading the body.
   * Returns `null` when the key does not exist. Used to validate a pre-signed
   * upload after the fact, cheaply (no bytes flow through the server).
   */
  head(key: string): Promise<ObjectHead | null>;

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
