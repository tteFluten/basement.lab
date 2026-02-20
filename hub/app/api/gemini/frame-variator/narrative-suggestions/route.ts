import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";
import { Type } from "@google/genai";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const analysis = body.analysis as Record<string, string> | undefined;
    const topic = (body.topic as string) ?? "";
    const prompt = `Based on technical plate analysis: ${JSON.stringify(analysis ?? {})}. 
    Exploration Topic: ${topic || "Narrative variation"}.
    
    Suggest 9 narrative beats. 
    MANDATORY RULES:
    1. Every suggestion MUST include a specific Technical Camera Direction (POV, Framing, Shot Type).
    2. Strictly preserve the Cinematic DNA (LUT, color grade, film grain, lighting temperature) described in the analysis.
    3. Character Likeness is non-negotiable.
    
    Structure the 'description' to include both the Story Beat and the Technical Shot type.
    Example: { "title": "The Discovery", "description": "Story: He finds a hidden key. Shot: Extreme Close-up on trembling hands. Style: Same LUT as source." }
    
    Return as JSON array of {title, description}.`;

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["title", "description"],
          },
        },
      },
    });
    const text = (response as { text?: string }).text ?? "";
    const result = JSON.parse(text || "[]");
    return NextResponse.json(result);
  } catch (e) {
    console.error("POST /api/gemini/frame-variator/narrative-suggestions:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
