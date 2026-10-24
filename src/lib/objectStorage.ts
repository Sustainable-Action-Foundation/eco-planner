import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/*
 * The S3-compatible bucket holding uploaded documents (Hetzner Object Storage in
 * production). The bucket stays private: uploads go through the attachment API, and
 * downloads are short-lived presigned links handed out after an access check.
 *
 * Configured with S3_ENDPOINT (e.g. https://fsn1.your-objectstorage.com), S3_REGION
 * (the location, e.g. fsn1), S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.
 * Without them uploads are refused with a clear message instead of failing halfway.
 * S3_PUBLIC_ENDPOINT is for setups where browsers reach the bucket by another address
 * than the app does (the docker test stack); download links are signed for it.
 */

type StorageConfig = {
  endpoint: string;
  /** Where download links point; the same as `endpoint` unless overridden */
  publicEndpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** Seconds a download link stays valid: long enough to click, short enough not to be worth sharing. */
const downloadLinkLifetime = 5 * 60;

function readConfig(): StorageConfig | null {
  const { S3_ENDPOINT, S3_PUBLIC_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return {
    endpoint: S3_ENDPOINT,
    publicEndpoint: S3_PUBLIC_ENDPOINT || S3_ENDPOINT,
    // Hetzner locations double as regions; "auto" is fine for providers that don't care
    region: S3_REGION || "auto",
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  };
}

type Storage = {
  client: S3Client;
  /** Signs download links; a separate client when browsers reach the bucket by another address */
  presigner: S3Client;
  bucket: string;
};

let cached: Storage | null = null;

function storage(): Storage | null {
  if (cached) return cached;
  const config = readConfig();
  if (!config) return null;
  const clientFor = (endpoint: string) => new S3Client({
    endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Path-style URLs work without wildcard DNS for the bucket and on every S3-compatible provider
    forcePathStyle: true,
  });
  const client = clientFor(config.endpoint);
  cached = {
    client,
    presigner: config.publicEndpoint === config.endpoint ? client : clientFor(config.publicEndpoint),
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
 * Whether the file behind `key` is still in the bucket. Files can disappear behind the
 * app's back (someone tidying the bucket in the provider's console), and the download
 * link should say so rather than hand out a link to an error page. On any failure other
 * than a plain "not found" the file is assumed present, so an outage doesn't read as loss.
 */
export async function storedObjectExists(key: string): Promise<boolean> {
  const store = storage();
  if (!store) throw new Error("Object storage is not configured");
  try {
    await store.client.send(new HeadObjectCommand({ Bucket: store.bucket, Key: key }));
    return true;
  } catch (error) {
    const status = typeof error === "object" && error && "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
    if (status === 404 || (error instanceof Error && error.name === "NotFound")) return false;
    console.error("Failed to check a stored attachment", { key, error });
    return true;
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
  return getSignedUrl(store.presigner, new GetObjectCommand({
    Bucket: store.bucket,
    Key: key,
    ResponseContentType: contentType,
    ResponseContentDisposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  }), { expiresIn: downloadLinkLifetime });
}
