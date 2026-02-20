import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const sourceBase64 = (body.sourceBase64 as string) ?? "";
    const sourceMime = (body.sourceMime as string) ?? "image/png";
    const referenceBase64 = (body.referenceBase64 as string) ?? "";
    const referenceMime = (body.referenceMime as string) ?? "image/png";
    const styleManifest = (body.styleManifest as string) ?? "";
    const userPrompt = (body.userPrompt as string) ?? "";
    const options = body.options as Record<string, boolean> | undefined;
    const aspectRatio = (body.aspectRatio as string) ?? "1:1";
    const quality = (body.quality as string) ?? "standard";

    const srcData = sourceBase64.includes(",") ? sourceBase64.split(",")[1] : sourceBase64;
    const refData = referenceBase64.includes(",") ? referenceBase64.split(",")[1] : referenceBase64;
    if (!srcData || !refData) return NextResponse.json({ error: "sourceBase64 and referenceBase64 required" }, { status: 400 });

    const activeLocks: string[] = [];
    if (options?.matchBackground) activeLocks.push("SYNC_BACKGROUND: Copia exacta del fondo de la IMAGEN_2.");
    if (options?.matchClothingStyle) activeLocks.push("SYNC_CLOTHING: Aplica el estilo y corte de ropa de la IMAGEN_2.");
    if (options?.matchLighting) activeLocks.push("SYNC_LIGHT: Replica la iluminación de la IMAGEN_2.");
    if (options?.matchColorPalette) activeLocks.push("SYNC_COLOR: Iguala el grading cromático de la IMAGEN_2.");
    if (options?.matchPose) activeLocks.push("SYNC_POSE: El sujeto adopta la pose y ángulo de la IMAGEN_2.");
    if (options?.matchGraphicDetails) activeLocks.push("SYNC_ART: Incorpora elementos gráficos o arte de la IMAGEN_2.");

    const systemPrompt = `
    INSTRUCCIONES DE SISTEMA // PROTOCOLO DE IDENTIDAD:
    - CONSERVAR EL 100% DE LOS RASGOS FACIALES DE LA IMAGEN_1.
    - PROHIBIDO FACE-SWAP CON IMAGEN_2.
    - EL SUJETO DE LA IMAGEN_1 DEBE SER RECONOCIBLE.
    ADN DE SESIÓN (REFERENCIA IMAGEN_2):
    ${styleManifest}
    BLOQUEOS DE CONSISTENCIA ACTIVOS:
    ${activeLocks.map((l) => `- ${l}`).join("\n")}
    INPUT USUARIO:
    ${userPrompt}
    REGLA FINAL: Devuelve únicamente la imagen resultante en fotorrealismo de alta gama.`;

    const isPro = quality === "high";
    const imageConfig: Record<string, string> = { aspectRatio };
    if (isPro) imageConfig.imageSize = "4K";

    const model = (body.model as string) ?? "gemini-2.5-flash-image";
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: "SUJETO_BASE (CARA A PRESERVAR):" },
          { inlineData: { data: srcData, mimeType: sourceMime } },
          { text: "ESTÉTICA_MASTER (ESTILO A REPLICAR):" },
          { inlineData: { data: refData, mimeType: referenceMime } },
          { text: systemPrompt },
        ],
      },
      config: { imageConfig },
    });

    const r = response as unknown as Record<string, unknown>;
    const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as { parts?: Array<{ inlineData?: { data: string } }> } | undefined;
    const part = content?.parts?.find((p) => p.inlineData);
    const data = part?.inlineData?.data;
    if (!data) return NextResponse.json({ error: "NULL_IMAGE_DATA" }, { status: 500 });
    return NextResponse.json({ dataUrl: `data:image/png;base64,${data}` });
  } catch (e) {
    console.error("POST /api/gemini/avatar/transform:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
