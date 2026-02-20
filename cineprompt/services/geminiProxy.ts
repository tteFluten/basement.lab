function getHubApiBase(): string | null {
  if (typeof window === "undefined") return null;
  if (window.location.pathname.startsWith("/embed/")) return window.location.origin;
  return null;
}

export async function hubGeminiGenerate(params: {
  prompt: string;
  imageBase64?: string;
  imageMime?: string;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  responseMimeType?: string;
}): Promise<{ dataUrl?: string; text?: string }> {
  const base = getHubApiBase();
  if (!base) return { dataUrl: undefined, text: undefined };
  const res = await fetch(`${base}/api/gemini/cineprompt/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "API error");
  return data as { dataUrl?: string; text?: string };
}

export function isEmbedMode(): boolean {
  return getHubApiBase() !== null;
}
