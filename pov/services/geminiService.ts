
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-3-pro-image-preview';

export async function generateProImage(params: {
  prompt: string;
  imageInput?: string; // base64
  isGrid: boolean;
  gridSize?: number;
  resolution: '1K' | '2K' | '4K';
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
}) {
  // Always create a new GoogleGenAI instance right before the call to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let finalPrompt = params.prompt;
  if (params.isGrid) {
    const count = params.gridSize || 4;
    finalPrompt = `Create a ${count}x${count} grid showing different distinct variations and concepts for: ${params.prompt}. Each cell should be a unique take on the subject. High quality, professional concept art.`;
  }

  const parts: any[] = [{ text: finalPrompt }];
  
  if (params.imageInput) {
    // Extract MIME type and clean base64 data from the data URL
    const mimeMatch = params.imageInput.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const cleanBase64 = params.imageInput.split(',')[1];
    
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: params.aspectRatio,
          imageSize: params.resolution
        }
      },
    });

    // Iterate through response parts to find the generated image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image was generated in the response.");
  } catch (error: any) {
    // Reset key selection state if the API key is invalid or not found
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("AUTH_REQUIRED");
    }
    throw error;
  }
}
