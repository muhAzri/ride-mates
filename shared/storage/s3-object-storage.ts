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
} from '@aws-sdk/client-s3';
import { ApiError } from '@/shared/http/api-error';
import type { ObjectStorage, PutObjectInput } from './object-storage';
import { getStorageConfig, type StorageConfig } from './storage.config';

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
          ACL: 'public-read',
        }),
      );
    } catch (error) {
      console.error('[storage] put failed', error);
      throw ApiError.internal('Could not store the uploaded file. Please try again.');
    }

    return this.publicUrl(input.key);
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
