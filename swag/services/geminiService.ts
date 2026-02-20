
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
}

export const generateMockup = async (params: GenerateImageParams): Promise<string> => {
  const base = getHubApiBase();
  if (base) {
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

  let prompt = `Act as a world-class CGI artist specializing in physical product simulation. 
  Create a hyper-realistic, high-fidelity render of a ${params.mockupType}.
  
  ARTISTIC DIRECTION:
  - THEME: ${params.stylePreset}. ${currentStyleModifier}
  
  PHYSICAL INTEGRATION (CRITICAL):
  1. MATERIAL DISPLACEMENT: The logo MUST NOT look flat. It must follow the exact 3D morphology of the surface. On fabric (${params.mockupType}), the logo must warp, stretch, and bend into every wrinkle and fold as if screen-printed or embroidered.
  2. SURFACE TEXTURE: The micro-texture of the material (cotton fibers, ceramic glaze, paper grain, or metal) must be visible through the ink of the logo. Use realistic displacement mapping.
  3. LIGHTING INTERACTION: Shadows and highlights must wrap around the logo's placement. If the logo is on a hoodie, show the subtle sheen of the ink against the matte fabric. If on a mug, show the specular highlights reflecting across the logo surface.
  4. NO FLOATING: The logo must appear chemically or physically bonded to the object. No "sticker" effect unless specifically a sticker.
  
  Ensure the final image looks like a professional product shot from a high-end brand campaign.`;

  if (params.styleBase64) {
    prompt += ` \n\nSTYLE INSPIRATION: Use the provided reference image for lighting, color temperature, and environmental mood.`;
  }

  const parts: any[] = [{ text: prompt }];
  
  // Add Logo - ensure it's treated as a source
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
