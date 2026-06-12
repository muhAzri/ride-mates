/**
 * Avatar storage-key convention (UA-4). One deterministic key per user means an
 * avatar change *overwrites* the previous object rather than piling up orphaned
 * files — the storage-thrift requirement. The key has no file extension on
 * purpose: the content type is carried as object metadata, so switching between
 * WebP/JPEG/PNG never spawns a second object under a different name.
 *
 * Because the URL is otherwise stable across changes, callers append a
 * cache-busting `?v=` token (see `setAvatarUrlWithCacheBust`) so CDNs/clients
 * pick up the new image immediately.
 */

/** Folder that holds user avatars in the bucket. */
export const AVATAR_PREFIX = 'avatars';

/** The single, stable object key for a user's avatar. */
export function avatarKey(userId: string): string {
  return `${AVATAR_PREFIX}/${userId}`;
}

/** Append a cache-busting version token to a freshly-written avatar URL. */
export function withCacheBust(url: string, version: number = Date.now()): string {
  return `${url}?v=${version}`;
}
