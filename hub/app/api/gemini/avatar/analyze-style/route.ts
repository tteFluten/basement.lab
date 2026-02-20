import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const imageBase64 = (body.imageBase64 as string) ?? "";
    const mimeType = (body.mimeType as string) ?? "image/png";
    const base64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    if (!base64) return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: "ANÁLISIS DE DIRECTOR DE ARTE TÉCNICO. Define los parámetros exactos para replicar: 1. Vestimenta (tipo de prenda, material), 2. Pose (ángulo de hombros, inclinación de cabeza), 3. Luz (fuentes, dirección, contraste), 4. Paleta de color (grados Kelvin, saturación), 5. Fondo (distancia focal, color base), 6. Detalles gráficos. Responde en una línea de keywords técnicas separadas por barras //" },
        ],
      },
    });
    const text = (response as unknown as { text?: string }).text ?? "STANDARD_PORTRAIT // NEUTRAL_LIGHT";
    return NextResponse.json({ result: text });
  } catch (e) {
    console.error("POST /api/gemini/avatar/analyze-style:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
