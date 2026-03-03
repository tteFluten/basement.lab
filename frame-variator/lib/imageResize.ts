/**
 * Resize and compress a data URL image for API uploads to avoid 413.
 * Returns a JPEG data URL with max long edge and quality.
 */
export function resizeImageForApi(
  dataUrl: string,
  maxLongEdge: number = 1920,
  quality: number = 0.85
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
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}
