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

export interface HistoryTurn {
  userPrompt: string;
  resultImagePart: { data: string; mimeType: string };
}

export interface GenerateParams {
  prompt: string;
  imageParts: Array<{ data: string; mimeType: string }>;
  aspectRatio?: string;
  imageSize?: string;
  history?: HistoryTurn[];
}

export interface GenerateResult {
  dataUrl?: string;
  text?: string;
}

const IMPROVE_SYSTEM =
  "You write concise, vivid image generation prompts. Output only the prompt, no explanations, no quotes, no preamble.";

const improveUserMessage = (prompt: string, imageCount: number) =>
  `You are an expert at writing prompts for AI image generation models like Gemini.

Improve the following prompt to be more vivid, specific, and effective for generating high-quality images. Keep the original intent and subject. Return ONLY the improved prompt text, nothing else.

${imageCount > 0 ? `Context: the user has ${imageCount} reference image(s) attached.\n\n` : ""}Prompt to improve:
${prompt || "(empty — suggest a creative starting prompt for an abstract or generative image)"}`;

export async function improvePrompt(currentPrompt: string, imageCount: number): Promise<string> {
  const base = getHubApiBase();
  if (base) {
    const res = await fetch(`${base}/api/gemini/nanobanana/improve-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: currentPrompt, imageCount }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? "API error");
    return (data as { prompt: string }).prompt;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey?.trim()) throw new Error("API_KEY_ERROR");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [{ text: improveUserMessage(currentPrompt, imageCount) }] },
    config: { systemInstruction: IMPROVE_SYSTEM },
  });

  const r = response as unknown as Record<string, unknown>;
  const text =
    (r.text as string) ??
    (
      (r.candidates as Array<{ content: { parts: Array<{ text?: string }> } }> | undefined)?.[0]
        ?.content?.parts?.find((p) => p.text)?.text ?? ""
    );

  if (!text) throw new Error("No improved prompt returned.");
  return text.trim();
}

export async function generateImage(params: GenerateParams): Promise<GenerateResult> {
  const base = getHubApiBase();
  if (base) {
    const model = getHubModel();
    const res = await fetch(`${base}/api/gemini/nanobanana/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, model, history: params.history ?? [] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 413) throw new Error("Image or payload too large. Try fewer or smaller images.");
      throw new Error((data as { error?: string }).error ?? "API error");
    }
    return data as GenerateResult;
  }

  // Standalone mode — direct Gemini call
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey?.trim()) throw new Error("API_KEY_ERROR");

  const ai = new GoogleGenAI({ apiKey });

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

  type Part = { text: string } | { inlineData: { data: string; mimeType: string } };
  type Turn = { role: string; parts: Part[] };

  const contents: Turn[] = [];
  for (const turn of params.history ?? []) {
    contents.push({ role: "user", parts: [{ text: turn.userPrompt }] });
    contents.push({ role: "model", parts: [{ inlineData: turn.resultImagePart }] });
  }
  contents.push({
    role: "user",
    parts: [
      { text: params.prompt },
      ...params.imageParts.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
    ],
  });

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: contents as never,
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
