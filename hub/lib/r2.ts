import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME ?? "";
const publicUrl = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

export function hasR2(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucketName && publicUrl);
}

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  });
}

/** Server-side: generate a presigned PUT URL for direct browser upload.
 *  Returns { uploadUrl, publicUrl, key }. */
export async function createPresignedUpload(
  filename: string,
  contentType: string,
  folder = "uploads",
  expiresIn = 3600
): Promise<{ uploadUrl: string; filePublicUrl: string; key: string }> {
  const ext = filename.split(".").pop() ?? "bin";
  const key = `${folder}/${randomUUID()}.${ext}`;

  const client = getClient();
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType }),
    { expiresIn }
  );

  return { uploadUrl, filePublicUrl: `${publicUrl}/${key}`, key };
}

/** Server-side: upload a buffer directly to R2. Returns public URL. */
export async function uploadBuffer(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({ Bucket: bucketName, Key: key, Body: body, ContentType: contentType })
  );
  return `${publicUrl}/${key}`;
}
