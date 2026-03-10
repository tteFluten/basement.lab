/**
 * Upload image for feedback comments (paste, file, or dataUrl).
 * Returns public URL or null on failure.
 */
export async function uploadFeedbackImage(
  source: File | Blob | string,
  filename = "paste.png"
): Promise<string | null> {
  let file: File | Blob;
  const contentType = "image/png";

  if (typeof source === "string") {
    if (!source.startsWith("data:image/")) return null;
    const res = await fetch(source);
    const blob = await res.blob();
    file = new File([blob], filename, { type: blob.type || contentType });
  } else {
    file = source instanceof File ? source : new File([source], filename, { type: source.type || contentType });
  }

  const fname = file instanceof File ? file.name : filename;
  const res = await fetch("/api/feedback/upload/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: fname, contentType: file.type || contentType, size: file.size }),
  });
  if (!res.ok) return null;

  const init = (await res.json()) as { mode: string; uploadUrl?: string; publicUrl?: string };
  if (init.mode === "r2" && init.uploadUrl && init.publicUrl) {
    const putRes = await fetch(init.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || contentType },
    });
    return putRes.ok ? init.publicUrl : null;
  }
  return null;
}
