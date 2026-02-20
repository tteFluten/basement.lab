import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY;

export function hasGemini(): boolean {
  return Boolean(key?.trim());
}

export function getGemini(): GoogleGenAI {
  if (!key?.trim()) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenAI({ apiKey: key });
}
