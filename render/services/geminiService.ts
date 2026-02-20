
import { GoogleGenAI } from "@google/genai";

function getHubApiBase(): string | null {
  if (typeof window === "undefined") return null;
  if (window.location.pathname.startsWith("/embed/")) return window.location.origin;
  return null;
}

function getHubModel(): string {
  if (typeof window === "undefined") return "gemini-2.5-flash-image";
  return window.localStorage.getItem("hub_model_render") ?? "gemini-2.5-flash-image";
}

export async function generateRender(
  previewBase64: string,
  prompt: string,
  referenceBase64?: string
): Promise<string> {
  const base = getHubApiBase();
  if (base) {
    const res = await fetch(`${base}/api/gemini/render/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewBase64, prompt, referenceBase64, model: getHubModel() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "API_KEY_ERROR");
    return data.dataUrl as string;
  }

  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) throw new Error("API_KEY_ERROR");
  const ai = new GoogleGenAI({ apiKey });
  
  const parts = [];

  // Add the primary viewport preview
  parts.push({
    inlineData: {
      data: previewBase64.split(',')[1] || previewBase64,
      mimeType: 'image/png'
    }
  });

  // Add reference image if provided
  if (referenceBase64) {
    parts.push({
      inlineData: {
        data: referenceBase64.split(',')[1] || referenceBase64,
        mimeType: 'image/png'
      }
    });
  }

  // Add text instructions
  parts.push({
    text: `Render this viewport preview into a high-fidelity final image. 
           Instructions: ${prompt}. 
           Output must be hyper-realistic, high detail, 4K professional architectural/product rendering.`
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "4K"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data returned from model");
  } catch (error: any) {
    const msg = error?.message ?? '';
    if (msg.includes("Requested entity was not found") || msg.includes("API key not valid") || error?.status === 400) {
      throw new Error("API_KEY_ERROR");
    }
    throw error;
  }
}
