/**
 * S3-compatible implementation of the `ObjectStorage` port, targeting
 * IDCloudHost Object Storage (`is3.cloudhost.id`) — not AWS. We use the AWS SDK
 * v3 S3 client purely as an S3-protocol client: it is pointed at the IDCloudHost
 * endpoint with path-style addressing.
 *
 * Every upload is written with `ACL: public-read` so the returned URL is
 * immediately fetchable by web and mobile clients without a presign step.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiError } from '@/shared/http/api-error';
import type {
  ObjectHead,
  ObjectStorage,
  PresignPutInput,
  PresignedUpload,
  PutObjectInput,
} from './object-storage';
import { getStorageConfig, type StorageConfig } from './storage.config';

/** ACL every public object (and pre-signed upload) is written with. */
const PUBLIC_READ_ACL = 'public-read';

export class S3ObjectStorage implements ObjectStorage {
  private readonly config: StorageConfig;
  private readonly client: S3Client;

  constructor(config: StorageConfig = getStorageConfig()) {
    this.config = config;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(input: PutObjectInput): Promise<string> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl,
          ACL: PUBLIC_READ_ACL,
        }),
      );
    } catch (error) {
      console.error('[storage] put failed', error);
      throw ApiError.internal('Could not store the uploaded file. Please try again.');
    }

    return this.publicUrl(input.key);
  }

  async presignPut(input: PresignPutInput): Promise<PresignedUpload> {
    // ACL must be signed so the stored object is public; the client therefore has
    // to echo `x-amz-acl: public-read` (surfaced in `headers`) or the signature
    // mismatches. Content-Type is intentionally *not* signed — leaving it
    // unconstrained keeps the client simple, and `head` validates the result.
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        ACL: PUBLIC_READ_ACL,
      });
      const uploadUrl = await getSignedUrl(this.client, command, {
        expiresIn: input.expiresInSeconds,
      });
      const expiresAt = new Date(
        Date.now() + input.expiresInSeconds * 1000,
      ).toISOString();
      return {
        uploadUrl,
        method: 'PUT',
        headers: { 'x-amz-acl': PUBLIC_READ_ACL },
        expiresAt,
      };
    } catch (error) {
      console.error('[storage] presign failed', error);
      throw ApiError.internal('Could not start the upload. Please try again.');
    }
  }

  async head(key: string): Promise<ObjectHead | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return {
        contentLength: result.ContentLength ?? 0,
        contentType: (result.ContentType ?? '').split(';')[0].trim().toLowerCase(),
      };
    } catch (error) {
      // A missing object surfaces as 404 / NotFound — a normal "not uploaded yet"
      // signal, not a failure. Anything else is a real storage error.
      const name = (error as { name?: string; $metadata?: { httpStatusCode?: number } });
      if (name?.name === 'NotFound' || name?.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error('[storage] head failed', error);
      throw ApiError.internal('Could not verify the uploaded file. Please try again.');
    }
  }

  async remove(key: string): Promise<void> {
    try {
      // S3 DeleteObject is idempotent: removing a missing key still succeeds.
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
    } catch (error) {
      console.error('[storage] delete failed', error);
      throw ApiError.internal('Could not remove the stored file. Please try again.');
    }
  }

  async removeByUrl(url: string): Promise<void> {
    const prefix = `${this.config.publicBaseUrl}/`;
    if (!url.startsWith(prefix)) {
      // Not one of our objects (e.g. an external URL) — nothing to remove.
      return;
    }
    // Strip any cache-busting query before resolving the key.
    const key = url.slice(prefix.length).split('?')[0];
    if (key) await this.remove(key);
  }

  publicUrl(key: string): string {
    return `${this.config.publicBaseUrl}/${key}`;
  }
}
