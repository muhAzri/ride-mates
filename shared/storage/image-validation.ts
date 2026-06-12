/**
 * Image upload validation. The frontend already compresses & converts to WebP
 * before upload, so this is a defensive guard, not the primary compressor: it
 * rejects oversized files and disallowed types at the API boundary
 * (API_CONTRACT.md §4.3 — JPEG/PNG/WebP, avatar ≤5 MB).
 *
 * Failures map to 422 UNPROCESSABLE (the bytes are semantically wrong), matching
 * how the contract treats other "valid request, bad payload" cases.
 */
import { ApiError } from '@/shared/http/api-error';

export const ALLOWED_IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB (UA-4 / §4.3)

export interface UploadedImage {
  body: Buffer;
  contentType: string;
  size: number;
}

/**
 * Validate an uploaded avatar image. Returns the normalised content type
 * (frontend should send WebP; we still accept JPEG/PNG per the contract).
 */
export function assertValidAvatar(image: UploadedImage): AllowedImageType {
  if (image.size === 0) {
    throw ApiError.unprocessable('The uploaded file is empty.', {
      file: 'Choose an image to upload.',
    });
  }

  if (image.size > AVATAR_MAX_BYTES) {
    throw ApiError.unprocessable('Image is too large.', {
      file: 'Avatar must be 5 MB or smaller.',
    });
  }

  const type = image.contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(type as AllowedImageType)) {
    throw ApiError.unprocessable('Unsupported image type.', {
      file: 'Upload a WebP, JPEG or PNG image.',
    });
  }

  return type as AllowedImageType;
}
