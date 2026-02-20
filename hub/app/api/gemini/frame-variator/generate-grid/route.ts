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
    const analysis = body.analysis as { actor?: string } | undefined;
    const variations = (body.variations as Array<{ prompt: string }>) ?? [];
    const base64 = originalBase64.includes(",") ? originalBase64.split(",")[1] : originalBase64;
    if (!base64 || variations.length < 9) {
      return NextResponse.json({ error: "originalBase64 and 9 variations required" }, { status: 400 });
    }
    const gridPrompt = `TASK: Technical 3x3 Contact Sheet Render.
    TECHNICAL MANDATE: 
    - Absolute consistency of Cinematic DNA (Color Grade, LUT, Lens, Grain, Lighting Kelvin) across all 9 cells.
    - Character Likeness (${analysis?.actor ?? "subject"}) must be 1:1 consistent across all frames.
    - ABSOLUTELY NO TEXT: Do not render any text, labels, or watermarks. 
    - The output must be a clean 3x3 grid of pure cinematic frames.
    
    Grid Map:
    1: ${variations[0].prompt} | 2: ${variations[1].prompt} | 3: ${variations[2].prompt}
    4: ${variations[3].prompt} | 5: ${variations[4].prompt} | 6: ${variations[5].prompt}
    7: ${variations[6].prompt} | 8: ${variations[7].prompt} | 9: ${variations[8].prompt}
    
    Output: Clean 3x3 contact sheet image.`;

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: "image/jpeg" } },
          { text: gridPrompt },
        ],
      },
      config: {
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
      },
    });
    const r = response as unknown as Record<string, unknown>;
    const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as { parts?: Array<{ inlineData?: { data: string } }> } | undefined;
    const part = content?.parts?.find((p) => p.inlineData);
    const data = part?.inlineData?.data;
    if (!data) {
      return NextResponse.json({ error: "Contact sheet failed" }, { status: 500 });
    }
    return NextResponse.json({ dataUrl: `data:image/png;base64,${data}` });
  } catch (e) {
    console.error("POST /api/gemini/frame-variator/generate-grid:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
