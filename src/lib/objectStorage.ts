import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/*
 * The S3-compatible bucket holding uploaded documents (Hetzner Object Storage in
 * production). The bucket stays private: uploads go through the attachment API, and
 * downloads are short-lived presigned links handed out after an access check.
 *
 * Configured with S3_ENDPOINT (e.g. https://fsn1.your-objectstorage.com), S3_REGION
 * (the location, e.g. fsn1), S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.
 * Without them uploads are refused with a clear message instead of failing halfway.
 */

type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** Seconds a download link stays valid: long enough to click, short enough not to be worth sharing. */
const downloadLinkLifetime = 5 * 60;

function readConfig(): StorageConfig | null {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return {
    endpoint: S3_ENDPOINT,
    // Hetzner locations double as regions; "auto" is fine for providers that don't care
    region: S3_REGION || "auto",
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  };
}

let cached: { client: S3Client, bucket: string } | null = null;

function storage(): { client: S3Client, bucket: string } | null {
  if (cached) return cached;
  const config = readConfig();
  if (!config) return null;
  cached = {
    client: new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Path-style URLs work without wildcard DNS for the bucket and on every S3-compatible provider
      forcePathStyle: true,
    }),
    bucket: config.bucket,
  };
  return cached;
}

/** True when the bucket is configured, i.e. uploads can be accepted. */
export function isObjectStorageConfigured(): boolean {
  return readConfig() !== null;
}

/** Stores a file under `key`. Throws when storage is unconfigured or the upload fails. */
export async function putStoredObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const store = storage();
  if (!store) throw new Error("Object storage is not configured");
  await store.client.send(new PutObjectCommand({
    Bucket: store.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentLength: body.byteLength,
  }));
}

/**
 * Removes stored files. Best effort: a failure is logged, not thrown, since by the time
 * this runs the database rows are usually already gone and the user can't do anything
 * about a leftover object anyway.
 */
export async function deleteStoredObjects(keys: string[]): Promise<void> {
  const store = storage();
  if (!store || keys.length === 0) return;
  try {
    // DeleteObjects takes at most 1000 keys per call
    for (let start = 0; start < keys.length; start += 1000) {
      await store.client.send(new DeleteObjectsCommand({
        Bucket: store.bucket,
        Delete: { Objects: keys.slice(start, start + 1000).map(Key => ({ Key })), Quiet: true },
      }));
    }
  } catch (error) {
    console.error("Failed to delete stored attachments", { keys, error });
  }
}

/**
 * A short-lived link that downloads the stored file under its original name.
 * Served as an attachment (never inline) so nothing uploaded renders as a page.
 */
export async function presignedDownloadUrl(key: string, fileName: string, contentType: string): Promise<string> {
  const store = storage();
  if (!store) throw new Error("Object storage is not configured");
  // RFC 5987 encoding keeps non-ASCII names intact; the plain fallback is for old clients
  const asciiName = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return getSignedUrl(store.client, new GetObjectCommand({
    Bucket: store.bucket,
    Key: key,
    ResponseContentType: contentType,
    ResponseContentDisposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  }), { expiresIn: downloadLinkLifetime });
}
