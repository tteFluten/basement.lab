
import { GoogleGenAI } from "@google/genai";
import { StylingOptions, AspectRatio, QualityLevel } from "../types";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const analyzeReferenceStyle = async (referenceImage: File): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64 = await fileToBase64(referenceImage);
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: referenceImage.type } },
          { text: "ANÁLISIS DE DIRECTOR DE ARTE TÉCNICO. Define los parámetros exactos para replicar: 1. Vestimenta (tipo de prenda, material), 2. Pose (ángulo de hombros, inclinación de cabeza), 3. Luz (fuentes, dirección, contraste), 4. Paleta de color (grados Kelvin, saturación), 5. Fondo (distancia focal, color base), 6. Detalles gráficos. Responde en una línea de keywords técnicas separadas por barras //" }
        ]
      }
    });
    return response.text || "STUDIO_PRO // NEUTRAL_BG // SOFT_LIGHT";
  } catch (error) {
    console.error("ANALYSIS_FAIL:", error);
    return "STANDARD_PORTRAIT // NEUTRAL_LIGHT";
  }
};

export const transformImage = async (
  sourceImage: File,
  referenceImage: File,
  styleManifest: string,
  userPrompt: string,
  options: StylingOptions,
  aspectRatio: AspectRatio,
  quality: QualityLevel
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isPro = quality === 'high';
  const modelName = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  const sourceBase64 = await fileToBase64(sourceImage);
  const referenceBase64 = await fileToBase64(referenceImage);

  const activeLocks = [];
  if (options.matchBackground) activeLocks.push("SYNC_BACKGROUND: Copia exacta del fondo de la IMAGEN_2.");
  if (options.matchClothingStyle) activeLocks.push("SYNC_CLOTHING: Aplica el estilo y corte de ropa de la IMAGEN_2.");
  if (options.matchLighting) activeLocks.push("SYNC_LIGHT: Replica la iluminación de la IMAGEN_2.");
  if (options.matchColorPalette) activeLocks.push("SYNC_COLOR: Iguala el grading cromático de la IMAGEN_2.");
  if (options.matchPose) activeLocks.push("SYNC_POSE: El sujeto adopta la pose y ángulo de la IMAGEN_2.");
  if (options.matchGraphicDetails) activeLocks.push("SYNC_ART: Incorpora elementos gráficos o arte de la IMAGEN_2.");

  const systemPrompt = `
    INSTRUCCIONES DE SISTEMA // PROTOCOLO DE IDENTIDAD:
    - CONSERVAR EL 100% DE LOS RASGOS FACIALES DE LA IMAGEN_1.
    - PROHIBIDO FACE-SWAP CON IMAGEN_2.
    - EL SUJETO DE LA IMAGEN_1 DEBE SER RECONOCIBLE.
    
    ADN DE SESIÓN (REFERENCIA IMAGEN_2):
    ${styleManifest}

    BLOQUEOS DE CONSISTENCIA ACTIVOS:
    ${activeLocks.map(l => `- ${l}`).join('\n')}
    
    INPUT USUARIO:
    ${userPrompt}

    REGLA FINAL: Devuelve únicamente la imagen resultante en fotorrealismo de alta gama.
  `;

  const imageConfig: any = { aspectRatio };
  if (isPro) imageConfig.imageSize = "4K";

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: "SUJETO_BASE (CARA A PRESERVAR):" },
          { inlineData: { data: sourceBase64, mimeType: sourceImage.type } },
          { text: "ESTÉTICA_MASTER (ESTILO A REPLICAR):" },
          { inlineData: { data: referenceBase64, mimeType: referenceImage.type } },
          { text: systemPrompt },
        ],
      },
      config: { imageConfig }
    });

    let imageUrl = '';
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) throw new Error("NULL_IMAGE_DATA");
    return imageUrl;
  } catch (error: any) {
    if (error.message?.includes("400")) {
      throw new Error("INVALID_PARAMS (400)");
    }
    throw error;
  }
};
