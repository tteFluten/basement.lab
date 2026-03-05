import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

const SYSTEM_INSTRUCTION =
  "You write concise, vivid image generation prompts. Output only the prompt, no explanations, no quotes, no preamble.";

const userMessage = (prompt: string, imageCount: number) =>
  `You are an expert at writing prompts for AI image generation models like Gemini.

Improve the following prompt to be more vivid, specific, and effective for generating high-quality images. Keep the original intent and subject. Return ONLY the improved prompt text, nothing else.

${imageCount > 0 ? `Context: the user has ${imageCount} reference image(s) attached.\n\n` : ""}Prompt to improve:
${prompt || "(empty — suggest a creative starting prompt for an abstract or generative image)"}`;

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const prompt = (body.prompt as string) ?? "";
    const imageCount = (body.imageCount as number) ?? 0;

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: userMessage(prompt, imageCount) }] },
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    const r = response as unknown as Record<string, unknown>;
    const text =
      (r.text as string) ??
      (
        (r.candidates as Array<{ content: { parts: Array<{ text?: string }> } }> | undefined)?.[0]
          ?.content?.parts?.find((p) => p.text)?.text ?? ""
      );

    if (!text) return NextResponse.json({ error: "No output from model" }, { status: 500 });
    return NextResponse.json({ prompt: text.trim() });
  } catch (e) {
    console.error("POST /api/gemini/nanobanana/improve-prompt:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
