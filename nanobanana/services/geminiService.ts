import { GoogleGenAI } from "@google/genai";

function getHubApiBase(): string | null {
  if (typeof window === "undefined") return null;
  if (window.location.pathname.startsWith("/embed/")) return window.location.origin;
  return null;
}

const HUB_MODEL_KEY = "hub_model_nanobanana";
const DEFAULT_MODEL = "gemini-3.1-flash-image-preview";

export function getHubModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  return window.localStorage.getItem(HUB_MODEL_KEY) ?? DEFAULT_MODEL;
}

export function isEmbedMode(): boolean {
  return getHubApiBase() !== null;
}

export interface GenerateParams {
  prompt: string;
  imageParts: Array<{ data: string; mimeType: string }>;
  aspectRatio?: string;
  imageSize?: string;
}

export interface GenerateResult {
  dataUrl?: string;
  text?: string;
}

export async function generateImage(params: GenerateParams): Promise<GenerateResult> {
  const base = getHubApiBase();
  if (base) {
    const model = getHubModel();
    const res = await fetch(`${base}/api/gemini/nanobanana/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, model }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "API error");
    return data as GenerateResult;
  }

  // Standalone mode — direct Gemini call
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey?.trim()) throw new Error("API_KEY_ERROR");

  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: params.prompt },
    ...params.imageParts.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
  ];

  const config: Record<string, unknown> = {
    systemInstruction:
      "You are a professional image generation engine. Strictly follow the user's text prompt. If the user references images using @ID (e.g., @1, @2), use those specific images as visual references for style, composition, or subject as requested. If an image is provided but NOT explicitly mentioned in the prompt with its @ID, ignore it entirely. Always prioritize the text prompt instructions.",
  };
  if (params.aspectRatio || params.imageSize) {
    const imgCfg: Record<string, string> = {};
    if (params.aspectRatio) imgCfg.aspectRatio = params.aspectRatio;
    if (params.imageSize) imgCfg.imageSize = params.imageSize;
    config.imageConfig = imgCfg;
  }

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: { parts },
    config,
  });

  const candidates = (response as unknown as Record<string, unknown>).candidates as Array<Record<string, unknown>> | undefined;
  const content = candidates?.[0]?.content as { parts?: Array<{ inlineData?: { data: string; mimeType?: string }; text?: string }> } | undefined;

  const imagePart = content?.parts?.find((p) => p.inlineData);
  if (imagePart?.inlineData?.data) {
    const mime = imagePart.inlineData.mimeType ?? "image/png";
    return { dataUrl: `data:${mime};base64,${imagePart.inlineData.data}` };
  }

  const textPart = content?.parts?.find((p) => p.text);
  if (textPart?.text) return { text: textPart.text };

  throw new Error("No output generated.");
}
