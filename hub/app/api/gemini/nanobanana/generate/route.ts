import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const prompt = (body.prompt as string) ?? "";
    const imageParts = (body.imageParts as Array<{ data: string; mimeType: string }>) ?? [];
    const rawModel = (body.model as string) ?? "gemini-3.1-flash-image-preview";
    const aspectRatio = body.aspectRatio as string | undefined;
    const imageSize = body.imageSize as string | undefined;

    const MODEL_MAP: Record<string, string> = {
      "gemini-2.0-flash-exp": "gemini-2.5-flash",
      "gemini-3-flash-preview": "gemini-2.5-flash",
    };
    const IMAGE_CAPABLE_MODELS = new Set([
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
      "gemini-2.5-flash-image",
    ]);

    let model = MODEL_MAP[rawModel] ?? rawModel;
    if ((aspectRatio || imageSize) && !IMAGE_CAPABLE_MODELS.has(model)) {
      model = "gemini-3.1-flash-image-preview";
    }

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

    // Attached images first
    for (const img of imageParts) {
      const data = img.data.includes(",") ? img.data.split(",")[1] : img.data;
      parts.push({ inlineData: { data, mimeType: img.mimeType } });
    }
    parts.push({ text: prompt });

    const config: Record<string, unknown> = {
      systemInstruction:
        "You are a professional image generation engine. Strictly follow the user's text prompt. If the user references images using @ID (e.g., @1, @2), use those specific images as visual references for style, composition, or subject as requested. If an image is provided but NOT explicitly mentioned in the prompt with its @ID, ignore it entirely. Always prioritize the text prompt instructions.",
    };
    if (aspectRatio || imageSize) {
      const imgCfg: Record<string, string> = {};
      if (aspectRatio) imgCfg.aspectRatio = aspectRatio;
      if (imageSize) imgCfg.imageSize = imageSize;
      config.imageConfig = imgCfg;
    }

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: Object.keys(config).length > 0 ? config : undefined,
    });

    const r = response as unknown as Record<string, unknown>;
    const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as {
      parts?: Array<{ inlineData?: { data: string; mimeType?: string }; text?: string }>;
    } | undefined;

    const imagePart = content?.parts?.find((p) => p.inlineData);
    if (imagePart?.inlineData?.data) {
      const mime = imagePart.inlineData.mimeType ?? "image/png";
      return NextResponse.json({ dataUrl: `data:${mime};base64,${imagePart.inlineData.data}` });
    }

    const textPart = content?.parts?.find((p) => p.text);
    if (textPart?.text) return NextResponse.json({ text: textPart.text });

    const text = r.text as string | undefined;
    if (text) return NextResponse.json({ text });

    return NextResponse.json({ error: "No output from model" }, { status: 500 });
  } catch (e) {
    console.error("POST /api/gemini/nanobanana/generate:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
