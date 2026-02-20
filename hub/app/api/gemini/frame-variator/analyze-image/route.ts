import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";
import { Type } from "@google/genai";

export const runtime = "nodejs";

const ANALYZE_PROMPT = `As a Senior Digital Imaging Technician (DIT), analyze this source plate. Extract precise technical data:
1. Subject/Actor: Exact features, hair, wardrobe fabric, and skin-tone under current light.
2. Environment: Specific architecture, background depth, atmospheric fog/dust.
3. Cinematic DNA: Specific LUT (Look Up Table), color grading (e.g. Teal/Orange, bleach bypass), film grain intensity, lens flare/distortion, and light color temperature (Kelvin).
Return as a structured JSON object.`;

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const image = (body.image as string) ?? "";
    const base64 = image.includes(",") ? image.split(",")[1] : image;
    if (!base64) {
      return NextResponse.json({ error: "image required (data URL or base64)" }, { status: 400 });
    }
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: "image/jpeg" } },
          { text: ANALYZE_PROMPT },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            actor: { type: Type.STRING },
            environment: { type: Type.STRING },
            style: { type: Type.STRING },
            lighting: { type: Type.STRING },
          },
          required: ["description", "actor", "environment", "style", "lighting"],
        },
      },
    });
    const text = (response as { text?: string }).text ?? "";
    const result = JSON.parse(text || "{}");
    return NextResponse.json(result);
  } catch (e) {
    console.error("POST /api/gemini/frame-variator/analyze-image:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    const isKeyError = /API key|PERMISSION_DENIED|403/i.test(msg);
    return NextResponse.json(
      { error: msg },
      { status: isKeyError ? 403 : 500 }
    );
  }
}
