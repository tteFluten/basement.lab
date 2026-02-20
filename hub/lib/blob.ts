import { put, getDownloadUrl } from "@vercel/blob";

const token = process.env.BLOB_READ_WRITE_TOKEN;

export function hasBlob(): boolean {
  return Boolean(token);
}

/**
 * Upload a data URL (e.g. image) to Vercel Blob.
 * Tries public first; falls back to private. Returns blob URL or null.
 */
export async function uploadDataUrl(
  dataUrl: string,
  pathname: string
): Promise<string | null> {
  if (!token) return null;

  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  if (!base64) return null;

  try {
    const buffer = Buffer.from(base64, "base64");
    try {
      const blob = await put(pathname, buffer, { access: "public", addRandomSuffix: true });
      return blob.url;
    } catch {
      // @vercel/blob types omit "private" but it is supported at runtime
      const blob = await put(pathname, buffer, {
        access: "private",
        addRandomSuffix: true,
      } as unknown as Parameters<typeof put>[2]);
      return blob.url;
    }
  } catch (err) {
    console.error("Blob upload failed, skipping:", err);
    return null;
  }
}

/**
 * For private blob URLs, generate a short-lived download URL.
 * For public URLs (or non-blob URLs like data:), returns the original.
 */
export async function resolveBlobUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:") || !token) return url;
  try {
    const downloadUrl = await getDownloadUrl(url);
    return downloadUrl;
  } catch {
    return url;
  }
}
