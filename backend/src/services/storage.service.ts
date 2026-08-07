import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";

const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

export async function uploadToS3(params: {
  buffer: Buffer;
  key: string;
  mimeType: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.mimeType,
      ServerSideEncryption: "AES256",
    })
  );
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: key }),
    { expiresIn }
  );
}

// Whether the stored original is actually retrievable.
//
// getPresignedUrl SIGNS LOCALLY and never contacts AWS, so it happily returns a
// well-formed URL for an object that was never uploaded, lives in a bucket we no
// longer own, or sits behind a revoked key — the failure only surfaces later, in
// the user's browser, as raw S3 XML. This is the one call that asks AWS.
//
// "missing" and "unavailable" are deliberately separate: a deleted object is a
// permanent fact to state plainly, while a credential or network failure is
// transient and shouldn't tell the user their file is gone.
export type ObjectAvailability = "available" | "missing" | "unavailable";

export async function getObjectAvailability(key: string): Promise<ObjectAvailability> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: key }));
    return "available";
  } catch (err: any) {
    // S3 answers a HEAD for a missing key with a bare 404 and no error code,
    // so the status has to be checked alongside the name.
    //
    // REQUIRES s3:ListBucket ON THE BUCKET ARN (not just /*). Without it S3
    // returns 403 for a missing object instead of 404 — deliberately, so it
    // can't leak whether a key exists — and every deleted file would be
    // misreported as "unavailable" (transient, try again) rather than
    // "missing" (gone), which is the exact distinction this function exists
    // to make. Verified against the live bucket 2026-08-02.
    const status = err?.$metadata?.httpStatusCode;
    const name = err?.name ?? "";
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return "missing";
    console.error(`getObjectAvailability(${key}): ${name || "UnknownError"}: ${err?.message ?? err}`);
    return "unavailable";
  }
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: key }));
}

// Download the original uploaded file as a Buffer (used to edit the original
// document in place so exports retain the source formatting).
export async function downloadFromS3(key: string): Promise<Buffer> {
  const out = await s3.send(new GetObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: key }));
  const bytes = await out.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export function buildS3Key(userId: string, fileId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "bin";
  return `contracts/${userId}/${fileId}.${ext}`;
}
