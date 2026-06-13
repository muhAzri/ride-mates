/**
 * Feedback-screenshot storage-key convention. Each screenshot gets its own
 * immutable key under the user's folder. No file extension — content type is
 * object metadata.
 */

export const FEEDBACK_PREFIX = 'feedback';

/** Per-screenshot object key, namespaced by user: `feedback/{userId}/{uuid}`. */
export function screenshotKey(userId: string): string {
  return `${FEEDBACK_PREFIX}/${userId}/${crypto.randomUUID()}`;
}
