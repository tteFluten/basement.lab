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
    const direction = ((body.direction as string) ?? "PAST") as "PAST" | "FUTURE";
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    if (!base64Data) return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });

    const prompt = direction === "FUTURE"
      ? `ACT AS A SENIOR CINEMATOGRAPHER AND PHYSICS ANALYST.
Examine this frame of a video sequence.
Provide a "Predictive Consequence Analysis" to determine the state 5 seconds LATER.
CRITICAL FOCUS:
1. KINEMATIC PROJECTION: Project current trajectories forward.
2. MOTION COMPLETION: Identify the logical resolution of the current pose.
3. ABSOLUTE SCENE LOCK: Maintain identical gear, terrain, and lighting.
4. CAMERA PERSISTENCE: Same lens and framing style.
OUTPUT FORMAT (JSON):
{"thoughtProcess":"...","visualPrompt":"..."}`
      : `ACT AS A SENIOR CINEMATOGRAPHER AND PHYSICS ANALYST.
Examine this frame of a video sequence.
Provide a "Causal Reversal Analysis" to determine the state 5 seconds EARLIER.
CRITICAL FOCUS:
1. KINEMATIC BACKTRACKING: Analyze current trajectories.
2. CHARACTER POSE: Identify the logical "anticipation" of the current pose.
3. ABSOLUTE SCENE LOCK: Maintain identical gear, terrain, and lighting.
4. CAMERA PERSISTENCE: Keep the same lens and framing style.
OUTPUT FORMAT (JSON):
{"thoughtProcess":"...","visualPrompt":"..."}`;

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: "image/png" } },
          { text: prompt },
        ],
      },
      config: { responseMimeType: "application/json" },
    });
    const text = (response as unknown as { text?: string }).text ?? "{}";
    const result = JSON.parse(text);
    return NextResponse.json({
      thoughtProcess: result.thoughtProcess || "Analysis complete.",
      visualPrompt: result.visualPrompt || "Frame in high fidelity.",
    });
  } catch (e) {
    console.error("POST /api/gemini/chronos/analyze:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
