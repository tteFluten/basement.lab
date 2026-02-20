import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const originalBase64 = (body.originalBase64 as string) ?? "";
    const gridBase64 = (body.gridBase64 as string) ?? "";
    const selectedIndex = Number(body.selectedIndex) ?? 0;
    const prompt = (body.prompt as string) ?? "";
    const size = ((body.size as string) ?? "4K") as "1K" | "2K" | "4K";
    const orig = originalBase64.includes(",") ? originalBase64.split(",")[1] : originalBase64;
    const grid = gridBase64.includes(",") ? gridBase64.split(",")[1] : gridBase64;
    if (!orig || !grid) {
      return NextResponse.json({ error: "originalBase64 and gridBase64 required" }, { status: 400 });
    }
    const row = Math.floor(selectedIndex / 3) + 1;
    const col = (selectedIndex % 3) + 1;
    const model = (body.model as string) ?? "gemini-2.5-flash-image";
    const masterPrompt = `HIGH-FIDELITY NEURAL UPSCALE (16:9 CINEMATIC MASTER).
    
    TASK: Perform a literal high-resolution reconstruction of Frame #${selectedIndex + 1} from the provided Reference Grid.
    
    STRICT MANDATE:
    1. CONTENT FIDELITY: You must match the composition, pose, character expression, and environment of Cell #${selectedIndex + 1} (Row ${row}, Col ${col}) in the Reference Grid with 100% accuracy.
    2. DETAIL FIDELITY: Use the "SOURCE PLATE" provided as a reference for high-frequency textures, lighting Kelvin, and skin details.
    3. NO CREATIVE VARIATION: Do not change the angle, do not add elements, do not change the actor's clothing or position. This is an UPSCALE, not a re-generation.
    4. ASPECT RATIO: The output MUST be in cinematic 16:9 format.
    5. NO TEXT: No labels, numbers, or watermarks.
    
    The resulting image must look like the original cinema camera capture for: ${prompt}.`;

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { data: orig, mimeType: "image/jpeg" } },
          { inlineData: { data: grid, mimeType: "image/png" } },
          { text: masterPrompt },
        ],
      },
      config: {
        imageConfig: { aspectRatio: "16:9", imageSize: size },
      },
    });
    const r = response as unknown as Record<string, unknown>;
    const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as { parts?: Array<{ inlineData?: { data: string } }> } | undefined;
    const part = content?.parts?.find((p) => p.inlineData);
    const data = part?.inlineData?.data;
    if (!data) {
      return NextResponse.json({ error: "Final render failed" }, { status: 500 });
    }
    return NextResponse.json({ dataUrl: `data:image/png;base64,${data}` });
  } catch (e) {
    console.error("POST /api/gemini/frame-variator/generate-single:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
