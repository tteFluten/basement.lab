import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

const SYSTEM_INSTRUCTION =
  "You write concise, vivid image generation prompts. Output only the prompt, no explanations, no quotes, no preamble.";

const userText = (prompt: string, hasImages: boolean) =>
  `You are an expert at writing prompts for AI image generation models like Gemini.

${hasImages ? "Reference images are attached. Use them as visual context to make the prompt accurate and descriptive.\n\n" : ""}Improve the following prompt to be more vivid, specific, and effective. Keep the original intent. Return ONLY the improved prompt, nothing else.

Prompt to improve:
${prompt || "(empty — analyze the reference images if provided and write a creative prompt describing them, or suggest a vivid generative image prompt)"}`;

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const prompt = (body.prompt as string) ?? "";
    const imageParts = (body.imageParts as Array<{ data: string; mimeType: string }>) ?? [];

    type Part = { text: string } | { inlineData: { data: string; mimeType: string } };
    const parts: Part[] = [
      ...imageParts.map((img) => {
        const data = img.data.includes(",") ? img.data.split(",")[1] : img.data;
        return { inlineData: { data, mimeType: img.mimeType } };
      }),
      { text: userText(prompt, imageParts.length > 0) },
    ];

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts } as never,
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
