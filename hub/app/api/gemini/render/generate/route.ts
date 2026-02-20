import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const previewBase64 = (body.previewBase64 as string) ?? "";
    const prompt = (body.prompt as string) ?? "";
    const referenceBase64 = body.referenceBase64 as string | undefined;
    const previewData = previewBase64.includes(",") ? previewBase64.split(",")[1] : previewBase64;
    if (!previewData) return NextResponse.json({ error: "previewBase64 required" }, { status: 400 });

    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [
      { inlineData: { data: previewData, mimeType: "image/png" } },
    ];
    if (referenceBase64) {
      const refData = referenceBase64.includes(",") ? referenceBase64.split(",")[1] : referenceBase64;
      parts.push({ inlineData: { data: refData, mimeType: "image/png" } });
    }
    parts.push({
      text: `Render this viewport preview into a high-fidelity final image. Instructions: ${prompt}. Output must be hyper-realistic, high detail, 4K professional architectural/product rendering.`,
    });

    const model = (body.model as string) ?? "gemini-2.5-flash-image";
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: { imageConfig: { aspectRatio: "16:9", imageSize: "4K" } },
    });

    const r = response as unknown as Record<string, unknown>;
    const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as { parts?: Array<{ inlineData?: { data: string } }> } | undefined;
    const part = content?.parts?.find((p) => p.inlineData);
    const data = part?.inlineData?.data;
    if (!data) return NextResponse.json({ error: "No image data" }, { status: 500 });
    return NextResponse.json({ dataUrl: `data:image/png;base64,${data}` });
  } catch (e) {
    console.error("POST /api/gemini/render/generate:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
