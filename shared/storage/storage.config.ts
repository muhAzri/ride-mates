/**
 * Validated access to the S3-compatible object-storage configuration
 * (IDCloudHost Object Storage — server `is3.cloudhost.id`). Centralised so a
 * missing secret fails loudly here instead of deep inside an upload.
 *
 * The DB only ever stores URLs (see `supabase/README.md` → "Photos / media");
 * the bytes live in the bucket. Uploads are written `public-read` so the
 * returned URL is directly fetchable by any client (avatars, listing photos).
 */

export interface StorageConfig {
  /** Bare endpoint origin, e.g. `https://is3.cloudhost.id`. No trailing slash. */
  endpoint: string;
  /** SigV4 region label. IDCloudHost accepts any consistent value; default `us-east-1`. */
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /**
   * Public base URL objects are served from. Defaults to path-style
   * `${endpoint}/${bucket}`. Override (`S3_PUBLIC_BASE_URL`) when a CDN or custom
   * domain fronts the bucket (the contract shows `https://cdn.ridemates.app/...`).
   */
  publicBaseUrl: string;
}

let cached: StorageConfig | null = null;

function stripTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function getStorageConfig(): StorageConfig {
  if (cached) return cached;

  const endpoint = stripTrailingSlash(
    process.env.S3_ENDPOINT ?? 'https://is3.cloudhost.id',
  );
  const region = (process.env.S3_REGION ?? 'us-east-1').trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.S3_BUCKET?.trim();

  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'Object storage is not configured. Set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_BUCKET in .env.local',
    );
  }

  const publicBaseUrl = stripTrailingSlash(
    process.env.S3_PUBLIC_BASE_URL ?? `${endpoint}/${bucket}`,
  );

  cached = { endpoint, region, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
  return cached;
}
