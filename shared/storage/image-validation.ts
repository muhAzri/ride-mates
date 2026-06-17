/**
 * Image upload validation. The frontend already compresses & converts to WebP
 * before upload, so this is a defensive guard, not the primary compressor: it
 * rejects oversized files and disallowed types at the API boundary
 * (API_CONTRACT.md §4.3 — JPEG/PNG/WebP, avatar ≤5 MB).
 *
 * Uploads are pre-signed (R16/R17): the bytes never reach the server, so these
 * guards run on either the *declared* content type (when issuing an upload URL) or
 * the uploaded object's *metadata* (a `HEAD` on commit) — never on the bytes.
 * Failures map to 422 UNPROCESSABLE, matching how the contract treats other
 * "valid request, bad payload" cases.
 */
import { ApiError } from '@/shared/http/api-error';

export const ALLOWED_IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB (UA-4 / §4.3)
export const LISTING_PHOTO_MAX_BYTES = 8 * 1024 * 1024; // 8 MB (MP-1 / §4.3)

/** Just the metadata of an image — no bytes. Used to validate pre-signed uploads. */
export interface ImageMeta {
  contentType: string;
  size: number;
}

/**
 * Normalise + assert a declared content type is one we accept. For the pre-signed
 * flow this guards the *request* for an upload URL (before any bytes exist), so it
 * checks the type only — size is enforced later, after upload, via `head`.
 */
export function assertAllowedImageType(contentType: string): AllowedImageType {
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(type as AllowedImageType)) {
    throw ApiError.unprocessable('Unsupported image type.', {
      contentType: 'Upload a WebP, JPEG or PNG image.',
    });
  }
  return type as AllowedImageType;
}

/**
 * Validate an avatar from object metadata alone (size + type), after a client
 * uploaded straight to the bucket via a pre-signed URL (no bytes in memory).
 */
export function assertValidAvatarMeta(meta: ImageMeta): AllowedImageType {
  return assertValidImageMeta(meta, AVATAR_MAX_BYTES, 'Avatar must be 5 MB or smaller.');
}

/** Validate a listing photo from metadata alone (≤8 MB) — for the pre-signed flow. */
export function assertValidListingPhotoMeta(meta: ImageMeta): AllowedImageType {
  return assertValidImageMeta(meta, LISTING_PHOTO_MAX_BYTES, 'Each photo must be 8 MB or smaller.');
}

/** Validate a feedback screenshot from metadata alone (≤5 MB) — for the pre-signed flow. */
export function assertValidScreenshotMeta(meta: ImageMeta): AllowedImageType {
  return assertValidImageMeta(meta, AVATAR_MAX_BYTES, 'Screenshot must be 5 MB or smaller.');
}

function assertValidImageMeta(
  meta: ImageMeta,
  maxBytes: number,
  tooLarge: string,
): AllowedImageType {
  if (meta.size === 0) {
    throw ApiError.unprocessable('The uploaded file is empty.', {
      file: 'Choose an image to upload.',
    });
  }
  if (meta.size > maxBytes) {
    throw ApiError.unprocessable('Image is too large.', { file: tooLarge });
  }
  return assertAllowedImageType(meta.contentType);
}
