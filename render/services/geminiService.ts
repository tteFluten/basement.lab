
import { GoogleGenAI } from "@google/genai";

export async function generateRender(
  previewBase64: string,
  prompt: string,
  referenceBase64?: string
): Promise<string> {
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
      model: 'gemini-3-pro-image-preview',
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
