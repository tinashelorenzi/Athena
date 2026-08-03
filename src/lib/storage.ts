import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getStorageConfigInternal, type StorageConfig } from "@/lib/settings";

/**
 * Object storage for uploaded artifacts (evidence zips). Uses the AWS S3 SDK,
 * which also drives MinIO and other S3-compatible services when an `endpoint`
 * and `forcePathStyle` are set. Server-only.
 */
function clientFrom(cfg: StorageConfig): S3Client {
  return new S3Client({
    region: cfg.region || "us-east-1",
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: cfg.forcePathStyle,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
}

async function getClient(): Promise<{ client: S3Client; cfg: StorageConfig }> {
  const cfg = await getStorageConfigInternal();
  if (!cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new Error("Storage is not configured. Set it up in Settings → Storage.");
  }
  return { client: clientFrom(cfg), cfg };
}

/** Verify credentials/bucket by issuing a HeadBucket. Returns null on success. */
export async function testStorage(): Promise<string | null> {
  try {
    const { client, cfg } = await getClient();
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Unknown storage error";
  }
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { client, cfg } = await getClient();
  await client.send(
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  const { client, cfg } = await getClient();
  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key })).catch(() => {});
}

export { GetObjectCommand };
