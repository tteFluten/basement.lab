import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

const STYLE_MODIFIERS: Record<string, string> = {
  "Clean & Minimalist": "Extremely clean, negative space, sharp focus, essential elements only.",
  "Urban Industrial": "Gritty textures, concrete backgrounds, city lights, raw industrial feel.",
  "Apple Tech Editorial": "Crisp, high-tech aesthetic, subtle gradients, soft ambient light, premium gadget photography.",
  "High-End Luxury": "Elegant materials, marble, velvet, gold accents, soft sophisticated shadows.",
  "Clean Studio Lighting": "Neutral grey backdrop, perfect three-point lighting, commercial product photography.",
  "Oniric & Surreal": "Dreamlike, ethereal atmosphere, floating elements, surreal lighting, blurred boundaries between reality and imagination.",
  "Soft & Poetic": "Soft focus, romantic lighting, delicate compositions, nostalgia, cinematic bokeh and grain.",
  "Dark Apocalyptic": "Dystopian atmosphere, weathered textures, post-civilization decay, dramatic shadows, abandoned environment, moody lighting.",
  "Organic & Natural": "Overgrown with plants, lush greenery, soft sunlight through leaves, organic materials, wood and stone elements.",
};

export async function POST(request: NextRequest) {
  if (!hasGemini()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const logoBase64 = (body.logoBase64 as string) ?? "";
    const styleBase64 = body.styleBase64 as string | undefined;
    const mockupType = (body.mockupType as string) ?? "";
    const aspectRatio = ((body.aspectRatio as string) ?? "1:1") as "1:1" | "9:16" | "16:9";
    const stylePreset = (body.stylePreset as string) ?? "";
    const resolution = ((body.resolution as string) ?? "4K") as "1K" | "2K" | "4K";

    const logoData = logoBase64.includes(",") ? logoBase64.split(",")[1] : logoBase64;
    if (!logoData) {
      return NextResponse.json({ error: "logoBase64 required" }, { status: 400 });
    }

    const currentStyleModifier = STYLE_MODIFIERS[stylePreset] ?? "Clean, professional product photography.";

    let prompt = `Act as a world-class CGI artist specializing in physical product simulation. 
  Create a hyper-realistic, high-fidelity render of a ${mockupType}.
  
  ARTISTIC DIRECTION:
  - THEME: ${stylePreset}. ${currentStyleModifier}
  
  PHYSICAL INTEGRATION (CRITICAL):
  1. MATERIAL DISPLACEMENT: The logo MUST NOT look flat. It must follow the exact 3D morphology of the surface. On fabric (${mockupType}), the logo must warp, stretch, and bend into every wrinkle and fold as if screen-printed or embroidered.
  2. SURFACE TEXTURE: The micro-texture of the material (cotton fibers, ceramic glaze, paper grain, or metal) must be visible through the ink of the logo. Use realistic displacement mapping.
  3. LIGHTING INTERACTION: Shadows and highlights must wrap around the logo's placement. If the logo is on a hoodie, show the subtle sheen of the ink against the matte fabric. If on a mug, show the specular highlights reflecting across the logo surface.
  4. NO FLOATING: The logo must appear chemically or physically bonded to the object. No "sticker" effect unless specifically a sticker.
  
  Ensure the final image looks like a professional product shot from a high-end brand campaign.`;

    if (styleBase64) {
      prompt += ` \n\nSTYLE INSPIRATION: Use the provided reference image for lighting, color temperature, and environmental mood.`;
    }

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: prompt }];
    parts.push({ inlineData: { data: logoData, mimeType: "image/png" } });
    if (styleBase64) {
      const styleData = styleBase64.includes(",") ? styleBase64.split(",")[1] : styleBase64;
      parts.push({ inlineData: { data: styleData, mimeType: "image/jpeg" } });
    }

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize: resolution,
        },
      },
    });

    const r = response as unknown as Record<string, unknown>;
    const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as { parts?: Array<{ inlineData?: { data: string } }> } | undefined;
    const part = content?.parts?.find((p) => p.inlineData);
    const data = part?.inlineData?.data;
    if (!data) {
      return NextResponse.json({ error: "IMAGE_DATA_NOT_FOUND" }, { status: 500 });
    }
    return NextResponse.json({ dataUrl: `data:image/png;base64,${data}` });
  } catch (e) {
    console.error("POST /api/gemini/swag/generate-mockup:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    const isKeyError = /API key|PERMISSION_DENIED|403/i.test(msg);
    return NextResponse.json({ error: msg }, { status: isKeyError ? 403 : 500 });
  }
}
