/**
 * Resize image data URL so the request body stays under Vercel/API limit (~4.5MB).
 * Used when saving to history (POST /api/generations) to avoid 413.
 * Returns the same dataUrl if already under limit.
 */
const MAX_DATAURL_LENGTH = 2_000_000;

function resizeTo(
  dataUrl: string,
  maxLongEdge: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const scale = Math.min(1, maxLongEdge / Math.max(w, h));
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

const STEPS: [number, number][] = [
  [2048, 0.75],
  [1536, 0.65],
  [1024, 0.6],
  [768, 0.55],
];

export async function resizeDataUrlForApi(dataUrl: string): Promise<string> {
  if (dataUrl.length <= MAX_DATAURL_LENGTH) return dataUrl;
  let lastError: Error | null = null;
  for (const [maxEdge, quality] of STEPS) {
    try {
      const result = await resizeTo(dataUrl, maxEdge, quality);
      if (result.length <= MAX_DATAURL_LENGTH) return result;
      lastError = new Error("Payload still too large");
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("Resize failed");
}
