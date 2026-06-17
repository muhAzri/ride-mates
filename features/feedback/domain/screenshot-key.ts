/**
 * Feedback-screenshot storage-key convention. Each screenshot gets its own
 * immutable key under the user's folder. No file extension — content type is
 * object metadata.
 *
 * Screenshots upload pre-signed (R17): the client PUTs to a private *staging* key
 * first, then POST /feedback promotes it to its public *final* key. Staging
 * objects live under `_staging/` so a bucket lifecycle rule sweeps abandoned ones.
 */
import { STAGING_SEGMENT } from '@/shared/storage';

export const FEEDBACK_PREFIX = 'feedback';

/** Per-screenshot final object key, namespaced by user: `feedback/{userId}/{uuid}`. */
export function screenshotKey(userId: string): string {
  return `${FEEDBACK_PREFIX}/${userId}/${crypto.randomUUID()}`;
}

/** Private staging key for a pending upload: `feedback/_staging/{userId}/{ref}`. */
export function screenshotStagingKey(userId: string, ref: string): string {
  return `${FEEDBACK_PREFIX}/${STAGING_SEGMENT}/${userId}/${ref}`;
}
