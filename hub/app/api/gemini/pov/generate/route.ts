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
    const imageInput = body.imageInput as string | undefined;
    const isGrid = Boolean(body.isGrid);
    const gridSize = Number(body.gridSize) || 4;
    const resolution = ((body.resolution as string) ?? "4K") as "1K" | "2K" | "4K";
    const aspectRatio = ((body.aspectRatio as string) ?? "1:1") as "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

    let finalPrompt = prompt;
    if (isGrid) {
      finalPrompt = `Create a ${gridSize}x${gridSize} grid showing different distinct variations and concepts for: ${prompt}. Each cell should be a unique take on the subject. High quality, professional concept art.`;
    }

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: finalPrompt }];
    if (imageInput) {
      const mimeMatch = imageInput.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const cleanBase64 = imageInput.includes(",") ? imageInput.split(",")[1] : imageInput;
      parts.push({ inlineData: { data: cleanBase64, mimeType } });
    }

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: { parts },
      config: { imageConfig: { aspectRatio, imageSize: resolution } },
    });

    const r = response as unknown as Record<string, unknown>;
    const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as { parts?: Array<{ inlineData?: { data: string; mimeType?: string } }> } | undefined;
    const part = content?.parts?.find((p) => p.inlineData);
    const data = part?.inlineData?.data;
    const mime = part?.inlineData?.mimeType ?? "image/png";
    if (!data) return NextResponse.json({ error: "No image generated" }, { status: 500 });
    return NextResponse.json({ dataUrl: `data:${mime};base64,${data}` });
  } catch (e) {
    console.error("POST /api/gemini/pov/generate:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
