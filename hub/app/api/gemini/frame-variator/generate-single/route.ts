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
    const model = (body.model as string) ?? "gemini-3.1-flash-image-preview";
    const masterPrompt = `LITERAL UPSCALE: Copy the Reference Grid cell exactly. Do not reinterpret, reimagine, or alter anything.
    
    TASK: Pixel-perfect high-resolution reconstruction of the EXACT frame from Cell #${selectedIndex + 1} (Row ${row}, Col ${col}) in the Reference Grid.
    
    NON-NEGOTIABLE:
    1. COPY EXACTLY: Match composition, pose, expression, wardrobe, colors, lighting, and environment of the Reference Grid cell with 100% fidelity. No creative variation.
    2. UPSCALE ONLY: Add detail and sharpness. Do NOT add or remove objects, change faces, alter poses, or reinterpret the scene. This is a resolution increase, not a new generation.
    3. SOURCE PLATE: Use the first image for reference textures, skin, and lighting. The output must match the Reference Grid cell.
    4. ASPECT RATIO: 16:9 cinematic.
    5. NO TEXT: No labels, numbers, or watermarks.
    
    Output must be a direct upscale of the reference cell. Do not add artistic interpretation.`;

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
