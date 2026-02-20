
import { GoogleGenAI } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface AnalysisResult {
  thoughtProcess: string;
  visualPrompt: string;
}

/**
 * Step 1: Analyze the frame to understand what came immediately BEFORE it.
 */
export const analyzeCausality = async (imageBase64: string): Promise<AnalysisResult> => {
  const ai = getAI();
  const base64Data = imageBase64.split(',')[1] || imageBase64;

  const prompt = `ACT AS A SENIOR CINEMATOGRAPHER AND PHYSICS ANALYST.
  Examine this frame of a video sequence.
  Provide a "Causal Reversal Analysis" to determine the state 5 seconds EARLIER.

  CRITICAL FOCUS:
  1. KINEMATIC BACKTRACKING: Analyze current trajectories. Where were these objects 5 seconds ago?
  2. CHARACTER POSE: Identify the logical "anticipation" of the current pose.
  3. ABSOLUTE SCENE LOCK: Maintain identical gear, terrain, and lighting.
  4. CAMERA PERSISTENCE: Keep the same lens and framing style.

  OUTPUT FORMAT (JSON):
  {
    "thoughtProcess": "Brief breakdown of the physical and temporal transition.",
    "visualPrompt": "A descriptive prompt for an image generator focusing on the T-5s state. Use the keyword 'STRICT IDENTITY'."
  }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: 'image/png' } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const textResponse = response.text || '{}';
    const result = JSON.parse(textResponse);
    return {
      thoughtProcess: result.thoughtProcess || "Analysis complete.",
      visualPrompt: result.visualPrompt || "Preceding frame in high fidelity."
    };
  } catch (error) {
    console.error("Analysis Error:", error);
    throw new Error("Failed to calculate temporal vectors.");
  }
};

/**
 * Step 1b: Analyze the frame to understand what comes immediately AFTER it.
 */
export const analyzeConsequence = async (imageBase64: string): Promise<AnalysisResult> => {
  const ai = getAI();
  const base64Data = imageBase64.split(',')[1] || imageBase64;

  const prompt = `ACT AS A SENIOR CINEMATOGRAPHER AND PHYSICS ANALYST.
  Examine this frame of a video sequence.
  Provide a "Predictive Consequence Analysis" to determine the state 5 seconds LATER.

  CRITICAL FOCUS:
  1. KINEMATIC PROJECTION: Project current trajectories forward. Where will these objects be in 5 seconds?
  2. MOTION COMPLETION: Identify the logical resolution of the current pose. If they are winding up, they are striking. If they are falling, they have landed.
  3. ABSOLUTE SCENE LOCK: Maintain identical gear, terrain, and lighting.
  4. CAMERA PERSISTENCE: Same lens and framing style.

  OUTPUT FORMAT (JSON):
  {
    "thoughtProcess": "Brief breakdown of the physical and temporal progression.",
    "visualPrompt": "A descriptive prompt for an image generator focusing on the T+5s state. Use the keyword 'STRICT IDENTITY'."
  }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: 'image/png' } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const textResponse = response.text || '{}';
    const result = JSON.parse(textResponse);
    return {
      thoughtProcess: result.thoughtProcess || "Analysis complete.",
      visualPrompt: result.visualPrompt || "Future frame in high fidelity."
    };
  } catch (error) {
    console.error("Future Analysis Error:", error);
    throw new Error("Failed to project temporal consequences.");
  }
};

/**
 * Step 2: Reconstruct the frame using the visual prompt and the source as reference.
 */
export const reconstructFrame = async (
  visualPrompt: string, 
  sourceImageBase64: string, 
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1",
  direction: "PAST" | "FUTURE" = "PAST"
): Promise<string> => {
  const ai = getAI();
  const base64Data = sourceImageBase64.split(',')[1] || sourceImageBase64;

  const contextText = direction === "PAST" 
    ? "GENERATE PRECEDING FRAME: The attached image is the CURRENT state. Generate the frame for T-5 seconds EARLIER."
    : "GENERATE FUTURE FRAME: The attached image is the CURRENT state. Generate the frame for T+5 seconds LATER.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: 'image/png' } },
          { text: `${contextText}
          PROMPT: ${visualPrompt}.
          
          REQUIRED CONSTRAINTS:
          - MATCH THE ATTACHED IMAGE EXACTLY IN STYLE, LIGHTING, AND SUBJECT GEAR.
          - THE ONLY CHANGE IS THE POSE/POSITION BASED ON THE PROMPT.` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("Reconstruction process returned no visual data.");
  } catch (error) {
    console.error("Reconstruction Error:", error);
    throw error;
  }
};
