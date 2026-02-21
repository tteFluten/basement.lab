
import { GoogleGenAI } from "@google/genai";
import { MockupType, AspectRatio, StylePreset } from "../types";

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
    
    ARTISTIC DIRECTION:
    - THEME: ${params.stylePreset}. ${currentStyleModifier}
    ${params.additionalDetails ? `- CUSTOM DIRECTIVES: ${params.additionalDetails}` : ''}
    
    PHYSICAL INTEGRATION (CRITICAL):
    1. MATERIAL DISPLACEMENT: The logo MUST NOT look flat. It must follow the exact 3D morphology of the surface. On fabric (${params.mockupType}), the logo must warp, stretch, and bend into every wrinkle and fold as if screen-printed or embroidered.
    2. SURFACE TEXTURE: The micro-texture of the material (cotton fibers, ceramic glaze, paper grain, or metal) must be visible through the ink of the logo. Use realistic displacement mapping.
    3. LIGHTING INTERACTION: Shadows and highlights must wrap around the logo's placement.
    4. NO FLOATING: The logo must appear chemically or physically bonded to the object.
    
    Ensure the final image looks like a professional product shot.`;
    
    if (params.styleBase64) {
      prompt += ` \n\nSTYLE INSPIRATION: Use the provided Style Reference for lighting, colors, and mood.`;
    }
  }

  const parts: any[] = [{ text: prompt }];
  
  // LOGO_INPUT
  parts.push({
    inlineData: {
      data: params.logoBase64.split(',')[1],
      mimeType: 'image/png'
    }
  });

  // Reference_Input / Style Reference
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
      model: 'gemini-3-pro-image-preview',
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
