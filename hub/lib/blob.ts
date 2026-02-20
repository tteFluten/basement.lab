import { put } from "@vercel/blob";

const token = process.env.BLOB_READ_WRITE_TOKEN;

export function hasBlob(): boolean {
  return Boolean(token);
}

/**
 * Upload a data URL (e.g. image) to Vercel Blob.
 * Returns the blob URL or null if token is missing.
 */
export async function uploadDataUrl(
  dataUrl: string,
  pathname: string
): Promise<string | null> {
  if (!token) return null;

  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  if (!base64) return null;

  const buffer = Buffer.from(base64, "base64");
  const blob = await put(pathname, buffer, {
    access: "public",
    addRandomSuffix: true,
  });
  return blob.url;
}
