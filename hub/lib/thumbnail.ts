/**
 * Generate a small JPEG thumbnail from a data URL using canvas.
 * Runs client-side only. Returns a compact data URL (~15-30 KB).
 */
export function generateThumbnail(
  dataUrl: string,
  maxWidth = 400,
  quality = 0.65,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.naturalWidth, 1);
      const w = Math.round(img.naturalWidth * ratio);
      const h = Math.round(img.naturalHeight * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(""); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}
