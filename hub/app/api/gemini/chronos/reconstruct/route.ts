import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const visualPrompt = (body.visualPrompt as string) ?? "";
    const sourceImageBase64 = (body.sourceImageBase64 as string) ?? "";
    const aspectRatio = ((body.aspectRatio as string) ?? "1:1") as "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
    const direction = ((body.direction as string) ?? "PAST") as "PAST" | "FUTURE";
    const base64Data = sourceImageBase64.includes(",") ? sourceImageBase64.split(",")[1] : sourceImageBase64;
    if (!base64Data) return NextResponse.json({ error: "sourceImageBase64 required" }, { status: 400 });

    const contextText = direction === "FUTURE"
      ? "GENERATE FUTURE FRAME: The attached image is the CURRENT state. Generate the frame for T+5 seconds LATER."
      : "GENERATE PRECEDING FRAME: The attached image is the CURRENT state. Generate the frame for T-5 seconds EARLIER.";

    const model = (body.model as string) ?? "gemini-2.5-flash-image";
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: "image/png" } },
          { text: `${contextText}\nPROMPT: ${visualPrompt}.\nREQUIRED CONSTRAINTS:\n- MATCH THE ATTACHED IMAGE EXACTLY IN STYLE, LIGHTING, AND SUBJECT GEAR.\n- THE ONLY CHANGE IS THE POSE/POSITION BASED ON THE PROMPT.` },
        ],
      },
      config: { imageConfig: { aspectRatio } },
    });

    const r = response as unknown as Record<string, unknown>;
    const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as { parts?: Array<{ inlineData?: { data: string } }> } | undefined;
    const part = content?.parts?.find((p) => p.inlineData);
    const data = part?.inlineData?.data;
    if (!data) return NextResponse.json({ error: "Reconstruction returned no visual data" }, { status: 500 });
    return NextResponse.json({ dataUrl: `data:image/png;base64,${data}` });
  } catch (e) {
    console.error("POST /api/gemini/chronos/reconstruct:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
