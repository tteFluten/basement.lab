import { NextRequest, NextResponse } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

const STYLE_MODIFIERS: Record<string, string> = {
  "Reference Composition": "Match the visual language of the reference image exactly.",
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
    const additionalDetails = (body.additionalDetails as string) ?? "";
    const strictReference = body.strictReference === true;

    const logoData = logoBase64.includes(",") ? logoBase64.split(",")[1] : logoBase64;
    if (!logoData) {
      return NextResponse.json({ error: "logoBase64 required" }, { status: 400 });
    }

    const currentStyleModifier = STYLE_MODIFIERS[stylePreset] ?? "Clean, professional product photography.";

    let prompt = "";

    if (strictReference && styleBase64) {
      prompt = `Act as a world-class product re-branding and digital compositing specialist. 
    
    REFERENCE TEMPLATE: The provided Reference Image (Reference_Input).
    BRANDING SOURCE: The provided LOGO_INPUT image.

    CORE TASK: 
    Regenerate the EXACT scene from the Reference Image but perform a total "Product Design Swap".
    
    INSTRUCTIONS:
    1. ENVIRONMENT PERSISTENCE: Keep the environment, lighting, surface (table, wall, etc.), and background 100% identical to the Reference Image.
    2. PRODUCT REPLACEMENT: Identify the physical object in the Reference (e.g., a sticker, mug, t-shirt). Completely replace the existing graphic/art on that object with the LOGO_INPUT. 
    3. COLOR HARMONY (CRITICAL): Do not just paste the logo. Adapt the entire color palette of the product object to match the LOGO_INPUT. If the logo is red and black, the background of the sticker or the color of the object should change from its original color to a red or black tone that harmonizes with the new branding.
    4. MATERIAL TEXTURE: The new branding must respect the material properties of the object (folds in cloth, grain in paper, gloss on vinyl). It must look physically printed on, not digitally overlaid.
    
    ${additionalDetails ? `\n\nADDITIONAL_CONTEXT: ${additionalDetails}` : ''}`;
    } else {
      prompt = `Act as a world-class CGI artist specializing in physical product simulation.
  Create a hyper-realistic, high-fidelity render of a ${mockupType}.

  PRIMARY DIRECTIVE (NON-NEGOTIABLE):
  The FIRST IMAGE provided is the USER'S DESIGN. This is the artwork/graphic that MUST appear prominently on the ${mockupType}. 
  You must use THIS EXACT IMAGE as the main visual printed/applied on the product. Do NOT invent, replace, or ignore it. 
  Do NOT add any other logos, brands, or graphics — ONLY the provided design.

  ARTISTIC DIRECTION:
  - THEME: ${stylePreset}. ${currentStyleModifier}
  ${additionalDetails ? `- CUSTOM DIRECTIVES: ${additionalDetails}` : ''}

  PHYSICAL INTEGRATION (CRITICAL):
  1. MATERIAL DISPLACEMENT: The design MUST NOT look flat or digitally pasted. It must follow the exact 3D morphology of the surface. On fabric, it must warp, stretch, and bend into every wrinkle and fold as if screen-printed or embroidered. On paper (poster), it must show subtle paper texture and edge curl.
  2. SURFACE TEXTURE: The micro-texture of the material (cotton fibers, ceramic glaze, paper grain, vinyl, or metal) must be visible through the ink of the design. Use realistic displacement mapping.
  3. LIGHTING INTERACTION: Shadows and highlights must wrap around the design's placement naturally.
  4. NO FLOATING: The design must appear chemically or physically bonded to the object — printed, embossed, or screen-printed.
  5. DESIGN PROMINENCE: The user's design should be the HERO of the image — large, centered, and clearly visible on the product.

  Ensure the final image looks like a professional product shot featuring the provided design.`;

      if (styleBase64) {
        prompt += ` \n\nSTYLE INSPIRATION: Use the provided Style Reference for lighting, colors, and mood.`;
      }
    }

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: prompt }];
    parts.push({ inlineData: { data: logoData, mimeType: "image/png" } });
    if (styleBase64) {
      const styleData = styleBase64.includes(",") ? styleBase64.split(",")[1] : styleBase64;
      parts.push({ inlineData: { data: styleData, mimeType: "image/jpeg" } });
    }

    const model = (body.model as string) ?? "gemini-2.5-flash-image";
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model,
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
