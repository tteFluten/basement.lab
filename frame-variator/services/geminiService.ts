
import { GoogleGenAI, Type } from "@google/genai";
import { SceneAnalysis, NarrativeSuggestion, Variation } from "../types";

/** When running inside the Hub embed, use the Hub API so the API key stays server-side. */
function getHubApiBase(): string | null {
  if (typeof window === "undefined") return null;
  if (window.location.pathname.startsWith("/embed/")) return window.location.origin;
  return null;
}

/** Parse response as JSON; if body is not JSON (e.g. 413 "Request Entity Too Large"), throw a clear error. */
async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
    if (res.status === 413) throw new Error("Image or payload too large. Try a smaller image.");
    throw new Error(res.ok ? "Invalid server response" : (trimmed || `Request failed (${res.status})`));
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(trimmed.slice(0, 80) + (trimmed.length > 80 ? "…" : ""));
  }
}

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
    const base = getHubApiBase();
    if (base) {
      const res = await fetch(`${base}/api/gemini/frame-variator/analyze-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });
      const data = await parseJsonResponse<{ error?: string } & SceneAnalysis>(res);
      if (!res.ok) throw new Error(data.error ?? "API_KEY_ERROR");
      return data as SceneAnalysis;
    }
    const ai = this.getClient();
    const response = await this.wrapApiKeyError(ai.models.generateContent({
      model: "gemini-2.5-flash",
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
    const base = getHubApiBase();
    if (base) {
      const res = await fetch(`${base}/api/gemini/frame-variator/narrative-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, topic }),
      });
      const data = await parseJsonResponse<{ error?: string } & NarrativeSuggestion[]>(res);
      if (!res.ok) throw new Error(data.error ?? "API_KEY_ERROR");
      return data as NarrativeSuggestion[];
    }
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
      model: "gemini-2.5-flash",
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
    const base = getHubApiBase();
    if (base) {
      const model = typeof window !== "undefined" ? (window.localStorage.getItem("hub_model_frame-variator") ?? "gemini-3.1-flash-image-preview") : "gemini-3.1-flash-image-preview";
      const res = await fetch(`${base}/api/gemini/frame-variator/generate-grid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalBase64, analysis, variations, model }),
      });
      const data = await parseJsonResponse<{ error?: string; dataUrl?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "API error");
      return data.dataUrl as string;
    }
    const ai = this.getClient();

    const isPov = variations[0]?.type === 'camera';

    const modeDirective = isPov
      ? `SCENE LOCK (NON-NEGOTIABLE):
    This is a CAMERA-ONLY exercise. The scene, environment, characters, objects, actions, poses, wardrobe, and props must remain EXACTLY IDENTICAL across all 9 cells.
    Think of this as the SAME FROZEN MOMENT captured simultaneously by 9 different cameras placed at different positions and angles.
    - Do NOT change what is happening in the scene.
    - Do NOT add or remove any objects, characters, or environmental elements.
    - Do NOT change character pose, expression, or wardrobe.
    - ONLY the camera position, angle, framing, and focal length should change between cells.`
      : `NARRATIVE DIRECTION:
    Each cell represents a different narrative beat or story moment. The scene content, action, and composition can change between cells to tell a visual story.
    Maintain character likeness and cinematic DNA across all frames, but allow creative variation in staging, action, and environment as described in each cell prompt.`;

    const gridPrompt = `TASK: Technical 3x3 Contact Sheet Render.

    ${modeDirective}

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
      model: "gemini-2.5-flash-image",
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
    _analysis: SceneAnalysis,
    selectedIndex: number,
    prompt: string,
    size: "1K" | "2K" | "4K" = "4K"
  ): Promise<string> {
    const base = getHubApiBase();
    if (base) {
      const model = typeof window !== "undefined" ? (window.localStorage.getItem("hub_model_frame-variator") ?? "gemini-3.1-flash-image-preview") : "gemini-3.1-flash-image-preview";
      const res = await fetch(`${base}/api/gemini/frame-variator/generate-single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalBase64, gridBase64, selectedIndex, prompt, size, model }),
      });
      const data = await parseJsonResponse<{ error?: string; dataUrl?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "API error");
      return data.dataUrl as string;
    }
    const ai = this.getClient();
    const row = Math.floor(selectedIndex / 3) + 1;
    const col = (selectedIndex % 3) + 1;

    const masterPrompt = `LITERAL UPSCALE: Copy the Reference Grid cell exactly. Do not reinterpret, reimagine, or alter anything.
    
    TASK: Pixel-perfect high-resolution reconstruction of the EXACT frame from Cell #${selectedIndex + 1} (Row ${row}, Col ${col}) in the Reference Grid.
    
    NON-NEGOTIABLE:
    1. COPY EXACTLY: Match composition, pose, expression, wardrobe, colors, lighting, and environment of the Reference Grid cell with 100% fidelity. No creative variation.
    2. UPSCALE ONLY: Add detail and sharpness. Do NOT add or remove objects, change faces, alter poses, or reinterpret the scene. This is a resolution increase, not a new generation.
    3. SOURCE PLATE: Use the first image for reference textures, skin, and lighting. The output must match the Reference Grid cell.
    4. ASPECT RATIO: 16:9 cinematic.
    5. NO TEXT: No labels, numbers, or watermarks.
    
    Output must be a direct upscale of the reference cell. Do not add artistic interpretation.`;

    const response = await this.wrapApiKeyError(ai.models.generateContent({
      model: "gemini-2.5-flash-image",
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
