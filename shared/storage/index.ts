/**
 * Object-storage composition: one shared `ObjectStorage` instance for the whole
 * app. Features import `getObjectStorage()` and depend only on the port type, so
 * the concrete S3 adapter can be swapped in one place.
 */
import type { ObjectStorage } from './object-storage';
import { S3ObjectStorage } from './s3-object-storage';
export type {
  PresignPutInput,
  PresignedUpload,
  ObjectHead,
  CopyObjectInput,
} from './object-storage';
export {
  STAGING_SEGMENT,
  isUploadRef,
  commitStagedImage,
  type CommitStagedImageInput,
} from './staging';

let instance: ObjectStorage | null = null;

export function getObjectStorage(): ObjectStorage {
  if (!instance) {
    instance = new S3ObjectStorage();
  }
  return instance;
}

export type { ObjectStorage } from './object-storage';
export {
  assertValidAvatarMeta,
  assertValidListingPhotoMeta,
  assertValidScreenshotMeta,
  assertAllowedImageType,
  ALLOWED_IMAGE_TYPES,
  AVATAR_MAX_BYTES,
  LISTING_PHOTO_MAX_BYTES,
  type ImageMeta,
  type AllowedImageType,
} from './image-validation';
