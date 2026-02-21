
import { GoogleGenAI } from "@google/genai";
import { MockupType, AspectRatio, StylePreset } from "../types";

function getHubApiBase(): string | null {
  if (typeof window === "undefined") return null;
  if (window.location.pathname.startsWith("/embed/")) return window.location.origin;
  return null;
}

export interface GenerateImageParams {
  logoBase64: string;
  styleBase64?: string;
  mockupType: MockupType;
  aspectRatio: AspectRatio;
  stylePreset: StylePreset;
  resolution: "1K" | "2K" | "4K";
  additionalDetails?: string;
  strictReference?: boolean;
}

export const generateMockup = async (params: GenerateImageParams): Promise<string> => {
  const base = getHubApiBase();
  if (base) {
    const model = typeof window !== "undefined" ? (window.localStorage.getItem("hub_model_swag") ?? "gemini-2.5-flash-image") : "gemini-2.5-flash-image";
    const res = await fetch(`${base}/api/gemini/swag/generate-mockup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logoBase64: params.logoBase64,
        styleBase64: params.styleBase64,
        mockupType: params.mockupType,
        aspectRatio: params.aspectRatio,
        stylePreset: params.stylePreset,
        resolution: params.resolution,
        additionalDetails: params.additionalDetails,
        strictReference: params.strictReference,
        model,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "API_KEY_RESET");
    if (!data.dataUrl) throw new Error("IMAGE_DATA_NOT_FOUND");
    return data.dataUrl;
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure you have selected a valid key.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const styleModifiers: Record<StylePreset, string> = {
    [StylePreset.REFERENCE]: "Match the visual language of the reference image exactly.",
    [StylePreset.MINIMALIST]: "Extremely clean, negative space, sharp focus, essential elements only.",
    [StylePreset.URBAN]: "Gritty textures, concrete backgrounds, city lights, raw industrial feel.",
    [StylePreset.TECH_EDITORIAL]: "Crisp, high-tech aesthetic, subtle gradients, soft ambient light, premium gadget photography.",
    [StylePreset.LUXURY]: "Elegant materials, marble, velvet, gold accents, soft sophisticated shadows.",
    [StylePreset.STUDIO]: "Neutral grey backdrop, perfect three-point lighting, commercial product photography.",
    [StylePreset.ONIRIC]: "Dreamlike, ethereal atmosphere, floating elements, surreal lighting, blurred boundaries between reality and imagination.",
    [StylePreset.POETIC]: "Soft focus, romantic lighting, delicate compositions, nostalgia, cinematic bokeh and grain.",
    [StylePreset.APOCALYPTIC]: "Dystopian atmosphere, weathered textures, post-civilization decay, dramatic shadows, abandoned environment, moody lighting.",
    [StylePreset.NATURAL]: "Overgrown with plants, lush greenery, soft sunlight through leaves, organic materials, wood and stone elements."
  };

  const currentStyleModifier = styleModifiers[params.stylePreset];

  let prompt = "";

  if (params.strictReference && params.styleBase64) {
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
    
    ${params.additionalDetails ? `\n\nADDITIONAL_CONTEXT: ${params.additionalDetails}` : ''}`;
  } else {
    prompt = `Act as a world-class CGI artist specializing in physical product simulation.
    Create a hyper-realistic, high-fidelity render of a ${params.mockupType}.

    PRIMARY DIRECTIVE (NON-NEGOTIABLE):
    The FIRST IMAGE provided is the USER'S DESIGN. This is the artwork/graphic that MUST appear prominently on the ${params.mockupType}. 
    You must use THIS EXACT IMAGE as the main visual printed/applied on the product. Do NOT invent, replace, or ignore it. 
    Do NOT add any other logos, brands, or graphics — ONLY the provided design.

    ARTISTIC DIRECTION:
    - THEME: ${params.stylePreset}. ${currentStyleModifier}
    ${params.additionalDetails ? `- CUSTOM DIRECTIVES: ${params.additionalDetails}` : ''}

    PHYSICAL INTEGRATION (CRITICAL):
    1. MATERIAL DISPLACEMENT: The design MUST NOT look flat or digitally pasted. It must follow the exact 3D morphology of the surface. On fabric, it must warp, stretch, and bend into every wrinkle and fold as if screen-printed or embroidered. On paper (poster), it must show subtle paper texture and edge curl.
    2. SURFACE TEXTURE: The micro-texture of the material (cotton fibers, ceramic glaze, paper grain, vinyl, or metal) must be visible through the ink of the design. Use realistic displacement mapping.
    3. LIGHTING INTERACTION: Shadows and highlights must wrap around the design's placement naturally.
    4. NO FLOATING: The design must appear chemically or physically bonded to the object — printed, embossed, or screen-printed.
    5. DESIGN PROMINENCE: The user's design should be the HERO of the image — large, centered, and clearly visible on the product.

    Ensure the final image looks like a professional product shot featuring the provided design.`;
    
    if (params.styleBase64) {
      prompt += ` \n\nSTYLE INSPIRATION: Use the provided Style Reference for lighting, colors, and mood.`;
    }
  }

  const parts: any[] = [{ text: prompt }];
  
  parts.push({
    inlineData: {
      data: params.logoBase64.split(',')[1],
      mimeType: 'image/png'
    }
  });

  if (params.styleBase64) {
    parts.push({
      inlineData: {
        data: params.styleBase64.split(',')[1],
        mimeType: 'image/jpeg'
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: params.aspectRatio,
          imageSize: params.resolution
        }
      },
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("EMPTY_RESPONSE_PARTS");
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("IMAGE_DATA_NOT_FOUND");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_RESET");
    }
    throw error;
  }
};
