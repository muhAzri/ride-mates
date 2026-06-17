/**
 * Object-storage port (Dependency Inversion). Feature use-cases depend on this
 * interface, never on the concrete S3 client — swapping providers means writing
 * a new adapter and nothing else.
 *
 * Keying convention lives in the *callers* (e.g. the avatar use-case owns
 * `avatars/{userId}`), so this port stays a generic blob store usable by avatars,
 * listing photos, and feedback screenshots alike.
 */

export interface PresignPutInput {
  /** Full object key the client will upload to, e.g. `avatars/usr_01J...`. */
  key: string;
  /** Seconds the signed URL stays valid. Keep short — it's a one-shot upload. */
  expiresInSeconds: number;
  /**
   * Whether the uploaded object is served `public-read`. Default `true` (e.g.
   * avatars, uploaded straight to their final public key). Set `false` for
   * staging uploads that are private until a `copy` promotes them to a public
   * final key — keeps the client simple (no signed ACL header to echo).
   */
  public?: boolean;
}

export interface CopyObjectInput {
  /** Source object key (e.g. a staging key). */
  fromKey: string;
  /** Destination object key (the permanent, public key). */
  toKey: string;
  /** Content-Type to store on the destination (replaces the source's). */
  contentType: string;
  /** Cache-Control header to store on the destination. */
  cacheControl?: string;
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
   * Issue a pre-signed PUT so the client uploads bytes **directly** to the store,
   * keeping large payloads off the API server (bandwidth-thrift — matters on
   * metered hosts like Vercel). Public uploads are signed `public-read`; the
   * caller validates the result afterwards via `head` (size/type can't be
   * enforced at signing time). Overwrites the key.
   */
  presignPut(input: PresignPutInput): Promise<PresignedUpload>;

  /**
   * Read an object's metadata (size + content type) without downloading the body.
   * Returns `null` when the key does not exist. Used to validate a pre-signed
   * upload after the fact, cheaply (no bytes flow through the server).
   */
  head(key: string): Promise<ObjectHead | null>;

  /**
   * Server-side copy within the store (e.g. promote a private staging upload to a
   * public final key). The bytes move store-internally — they never transit the
   * API server — and the destination is written `public-read`. Returns the
   * destination's public URL.
   */
  copy(input: CopyObjectInput): Promise<string>;

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
