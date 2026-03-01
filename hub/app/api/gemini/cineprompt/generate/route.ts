import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const action = (body.action as string) ?? "generate";
    const prompt = (body.prompt as string) ?? "";
    const imageBase64 = body.imageBase64 as string | undefined;
    const imageMime = (body.imageMime as string) ?? "image/png";
    const rawModel = (body.model as string) ?? "gemini-2.5-flash";
    const MODEL_MAP: Record<string, string> = {
      "gemini-2.0-flash-exp": "gemini-2.5-flash",
      "gemini-3-flash-preview": "gemini-2.5-flash",
      "gemini-3-pro-preview": "gemini-2.5-flash",
    };
    let model = MODEL_MAP[rawModel] ?? rawModel;
    const aspectRatio = body.aspectRatio as string | undefined;
    const imageSize = body.imageSize as string | undefined;

    const IMAGE_CAPABLE_MODELS = new Set([
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
      "gemini-2.5-flash-image",
    ]);
    const needsImageConfig = !!(aspectRatio || imageSize);
    if (needsImageConfig && !IMAGE_CAPABLE_MODELS.has(model)) {
      model = "gemini-2.5-flash-image";
    }
    const responseMimeType = body.responseMimeType as string | undefined;

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
    if (imageBase64) {
      const data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      parts.push({ inlineData: { data, mimeType: imageMime } });
    }
    parts.push({ text: prompt });

    const config: Record<string, unknown> = {};
    if (responseMimeType) config.responseMimeType = responseMimeType;
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
    const text = (r.text as string) ?? undefined;
    const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as { parts?: Array<{ inlineData?: { data: string; mimeType?: string }; text?: string }> } | undefined;
    const imagePart = content?.parts?.find((p) => p.inlineData);
    if (imagePart?.inlineData?.data) {
      const mime = imagePart.inlineData.mimeType ?? "image/png";
      return NextResponse.json({ dataUrl: `data:${mime};base64,${imagePart.inlineData.data}` });
    }
    if (text) {
      return NextResponse.json({ text });
    }
    const textPart = content?.parts?.find((p) => p.text);
    if (textPart?.text) {
      return NextResponse.json({ text: textPart.text });
    }
    return NextResponse.json({ error: "No output from model" }, { status: 500 });
  } catch (e) {
    console.error("POST /api/gemini/cineprompt/generate:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
