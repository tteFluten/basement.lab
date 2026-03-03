/**
 * Resize a data URL to given max long edge and JPEG quality.
 */
function resizeTo(
  dataUrl: string,
  maxLongEdge: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
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
        reject(new Error("Canvas 2d not available"));
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

/** Vercel body limit ~4.5MB; we target ~1.5MB to be safe. */
const MAX_PAYLOAD_CHARS = 1_500_000;

/** Steps: [maxLongEdge, quality]. Each step is more aggressive. */
const FALLBACK_STEPS: [number, number][] = [
  [1024, 0.6],
  [720, 0.55],
  [512, 0.5],
  [384, 0.45],
];

/**
 * Bulletproof resize: ensures output stays under API body limit.
 * Tries progressively smaller sizes until payload is safe.
 * Use overrides for retry after 413 (e.g. { maxLongEdge: 384, quality: 0.45 }).
 */
export async function resizeImageForApi(
  dataUrl: string,
  overrides?: { maxLongEdge?: number; quality?: number }
): Promise<string> {
  if (overrides?.maxLongEdge != null && overrides?.quality != null) {
    return resizeTo(dataUrl, overrides.maxLongEdge, overrides.quality);
  }
  let lastError: Error | null = null;
  for (const [maxLongEdge, quality] of FALLBACK_STEPS) {
    try {
      const result = await resizeTo(dataUrl, maxLongEdge, quality);
      if (result.length <= MAX_PAYLOAD_CHARS) return result;
      lastError = new Error(`Payload still too large (${(result.length / 1024).toFixed(0)}KB)`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("Resize failed");
}

/** Most aggressive preset for retry after 413. */
export const RETRY_PRESET = { maxLongEdge: 384, quality: 0.45 } as const;
