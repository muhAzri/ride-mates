/**
 * Helpers for the pre-signed "staging → commit" upload flow (API_CONTRACT.md R17).
 *
 * Photos/screenshots whose keys are non-deterministic (a per-object UUID) can't
 * use the avatar's overwrite trick, so a naive direct-to-storage upload would
 * leave orphans whenever a form is abandoned or creation fails validation.
 *
 * Instead the client uploads to a **private staging key** under a `_staging/`
 * segment; on commit the server validates the object's metadata and promotes it
 * (server-side `copy`, no bytes through the server) to its **public final key**,
 * deleting the staging copy. Anything left in `_staging/` (abandoned uploads) is
 * swept by a bucket lifecycle rule — see `supabase/README.md` / the contract.
 */
import { ApiError } from '@/shared/http/api-error';
import type { ObjectStorage } from './object-storage';
import type { AllowedImageType, ImageMeta } from './image-validation';

/** Path segment that marks not-yet-committed uploads (targeted by lifecycle). */
export const STAGING_SEGMENT = '_staging';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether an upload ref is a well-formed UUID. Clients echo back the ref issued at
 * presign time; validating it keeps a caller from injecting arbitrary key paths.
 */
export function isUploadRef(ref: string): boolean {
  return UUID_RE.test(ref);
}

export interface CommitStagedImageInput {
  /** The private staging key the client uploaded to. */
  stagingKey: string;
  /** The permanent, public key to promote the object to. */
  finalKey: string;
  /** Per-surface metadata guard (size + type); throws 422 on a bad object. */
  validate: (meta: ImageMeta) => AllowedImageType;
  /** Cache-Control to store on the final object. */
  cacheControl?: string;
}

/**
 * Validate a staged upload and promote it to its final public key. Returns the
 * final public URL. A missing or invalid staged object is rejected (422) and the
 * staging object is removed so nothing lingers. The bytes never transit the
 * server: `head` reads metadata only and `copy` moves bytes store-internally.
 */
export async function commitStagedImage(
  storage: ObjectStorage,
  input: CommitStagedImageInput,
): Promise<string> {
  const meta = await storage.head(input.stagingKey);
  if (!meta) {
    throw ApiError.unprocessable('An uploaded image could not be found.', {
      file: 'Upload the image before submitting, then try again.',
    });
  }

  let contentType: AllowedImageType;
  try {
    contentType = input.validate({ size: meta.contentLength, contentType: meta.contentType });
  } catch (error) {
    // Reject + clean up: a too-large / wrong-type object must not linger.
    await storage.remove(input.stagingKey).catch(() => {});
    throw error;
  }

  const finalUrl = await storage.copy({
    fromKey: input.stagingKey,
    toKey: input.finalKey,
    contentType,
    cacheControl: input.cacheControl,
  });

  // The committed copy is the source of truth now; drop the staging object.
  await storage.remove(input.stagingKey).catch((e) =>
    console.error('[storage] staging cleanup failed', e),
  );

  return finalUrl;
}
