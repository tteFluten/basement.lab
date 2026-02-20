import { getGemini, hasGemini } from "@/lib/gemini";

const TAGS_PROMPT = `Look at this image and return 5 to 10 short descriptive tags for search (single words or two words, lowercase, in English). Examples: portrait, outdoor, sunset, product shot, logo, character, landscape. Return ONLY a JSON array of strings, no other text.`;

export async function generateImageTags(dataUrl: string): Promise<string[]> {
  if (!hasGemini()) return [];
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  if (!base64) return [];

  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: "image/png" } },
          { text: TAGS_PROMPT },
        ],
      },
    });
    const text = (response as { text?: string }).text?.trim() ?? "";
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 15);
    }
    return [];
  } catch {
    return [];
  }
}
