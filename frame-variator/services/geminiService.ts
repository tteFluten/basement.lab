
import { GoogleGenAI, Type } from "@google/genai";
import { SceneAnalysis, NarrativeSuggestion, Variation } from "../types";

export const CAMERA_POVS = [
  "Gran Plano General (Extreme Wide Shot), focus on architecture and environment context",
  "Plano Americano (Medium Long Shot), frame from knees up, balancing figure and space",
  "Primer Plano (Close-up), tight on facial expression and micro-emotions",
  "Plano Detalle (Detail Shot), macro view of a specific prop, hand, or eye",
  "Súper Macro (Extreme Close-up), focus on skin pores, iris, or fabric fibers",
  "Cenital (Top-down Bird's Eye), looking 90 degrees down from height",
  "Contrapicado (Low Angle Shot), ground-level perspective looking up at subject",
  "Plano Holandés (Dutch Angle), tilted horizon to inject psychological tension",
  "Plano de Perfil (Profile Shot), sharp side view following subject contour"
];

const ANALYZE_PROMPT = `As a Senior Digital Imaging Technician (DIT), analyze this source plate. Extract precise technical data:
1. Subject/Actor: Exact features, hair, wardrobe fabric, and skin-tone under current light.
2. Environment: Specific architecture, background depth, atmospheric fog/dust.
3. Cinematic DNA: Specific LUT (Look Up Table), color grading (e.g. Teal/Orange, bleach bypass), film grain intensity, lens flare/distortion, and light color temperature (Kelvin).
Return as a structured JSON object.`;

function isApiKeyError(err: any): boolean {
  const msg = String(err?.message ?? err?.error?.message ?? '');
  return msg.includes('API key not valid') || msg.includes('Requested entity was not found') || err?.status === 400;
}

export class GeminiService {
  private static getClient() {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) throw new Error('API_KEY_ERROR');
    return new GoogleGenAI({ apiKey });
  }

  private static wrapApiKeyError<T>(p: Promise<T>): Promise<T> {
    return p.catch((err) => {
      if (isApiKeyError(err)) throw new Error('API_KEY_ERROR');
      throw err;
    });
  }

  static async analyzeImage(base64Image: string): Promise<SceneAnalysis> {
    const ai = this.getClient();
    const response = await this.wrapApiKeyError(ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } },
          { text: ANALYZE_PROMPT }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            actor: { type: Type.STRING },
            environment: { type: Type.STRING },
            style: { type: Type.STRING },
            lighting: { type: Type.STRING },
          },
          required: ["description", "actor", "environment", "style", "lighting"]
        }
      }
    }));
    return JSON.parse(response.text || "{}");
  }

  static async getNarrativeSuggestions(analysis: SceneAnalysis, topic?: string): Promise<NarrativeSuggestion[]> {
    const ai = this.getClient();
    const prompt = `Based on technical plate analysis: ${JSON.stringify(analysis)}. 
    Exploration Topic: ${topic || 'Narrative variation'}.
    
    Suggest 9 narrative beats. 
    MANDATORY RULES:
    1. Every suggestion MUST include a specific Technical Camera Direction (POV, Framing, Shot Type).
    2. Strictly preserve the Cinematic DNA (LUT, color grade, film grain, lighting temperature) described in the analysis.
    3. Character Likeness is non-negotiable.
    
    Structure the 'description' to include both the Story Beat and the Technical Shot type.
    Example: { "title": "The Discovery", "description": "Story: He finds a hidden key. Shot: Extreme Close-up on trembling hands. Style: Same LUT as source." }
    
    Return as JSON array of {title, description}.`;

    const response = await this.wrapApiKeyError(ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["title", "description"]
          }
        }
      }
    }));
    return JSON.parse(response.text || "[]");
  }

  static async generateGrid(originalBase64: string, analysis: SceneAnalysis, variations: Variation[]): Promise<string> {
    const ai = this.getClient();
    const gridPrompt = `TASK: Technical 3x3 Contact Sheet Render.
    TECHNICAL MANDATE: 
    - Absolute consistency of Cinematic DNA (Color Grade, LUT, Lens, Grain, Lighting Kelvin) across all 9 cells.
    - Character Likeness (${analysis.actor}) must be 1:1 consistent across all frames.
    - ABSOLUTELY NO TEXT: Do not render any text, labels, or watermarks. 
    - The output must be a clean 3x3 grid of pure cinematic frames.
    
    Grid Map:
    1: ${variations[0].prompt} | 2: ${variations[1].prompt} | 3: ${variations[2].prompt}
    4: ${variations[3].prompt} | 5: ${variations[4].prompt} | 6: ${variations[5].prompt}
    7: ${variations[6].prompt} | 8: ${variations[7].prompt} | 9: ${variations[8].prompt}
    
    Output: Clean 3x3 contact sheet image.`;

    const response = await this.wrapApiKeyError(ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { data: originalBase64.split(',')[1], mimeType: "image/jpeg" } },
          { text: gridPrompt }
        ]
      },
      config: {
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
      }
    }));

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part?.inlineData) throw new Error("Contact sheet failed.");
    return `data:image/png;base64,${part.inlineData.data}`;
  }

  static async generateSingle(
    originalBase64: string, 
    gridBase64: string, 
    analysis: SceneAnalysis, 
    selectedIndex: number, 
    prompt: string, 
    size: "1K" | "2K" | "4K" = "4K"
  ): Promise<string> {
    const ai = this.getClient();
    const row = Math.floor(selectedIndex / 3) + 1;
    const col = (selectedIndex % 3) + 1;

    const masterPrompt = `HIGH-FIDELITY NEURAL UPSCALE (16:9 CINEMATIC MASTER).
    
    TASK: Perform a literal high-resolution reconstruction of Frame #${selectedIndex + 1} from the provided Reference Grid.
    
    STRICT MANDATE:
    1. CONTENT FIDELITY: You must match the composition, pose, character expression, and environment of Cell #${selectedIndex + 1} (Row ${row}, Col ${col}) in the Reference Grid with 100% accuracy.
    2. DETAIL FIDELITY: Use the "SOURCE PLATE" provided as a reference for high-frequency textures, lighting Kelvin, and skin details.
    3. NO CREATIVE VARIATION: Do not change the angle, do not add elements, do not change the actor's clothing or position. This is an UPSCALE, not a re-generation.
    4. ASPECT RATIO: The output MUST be in cinematic 16:9 format.
    5. NO TEXT: No labels, numbers, or watermarks.
    
    The resulting image must look like the original cinema camera capture for: ${prompt}.`;

    const response = await this.wrapApiKeyError(ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { data: originalBase64.split(',')[1], mimeType: "image/jpeg" } },
          { inlineData: { data: gridBase64.split(',')[1], mimeType: "image/jpeg" } },
          { text: masterPrompt }
        ]
      },
      config: {
        imageConfig: { aspectRatio: "16:9", imageSize: size }
      }
    }));

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part?.inlineData) throw new Error("Final render failed.");
    return `data:image/png;base64,${part.inlineData.data}`;
  }
}
