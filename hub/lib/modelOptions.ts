/**
 * Model options for image generation. Stored per-app in localStorage (hub_model_<appSlug>).
 * Apps read via getSelectedModel(appSlug) and send in API body.
 */
export const IMAGE_MODELS = [
  { id: "gemini-3.1-flash-image-preview", label: "Nano Banana 2 (recommended)" },
  { id: "gemini-3-pro-image-preview", label: "Nano Banana Pro" },
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Exp" },
] as const;

export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

const STORAGE_PREFIX = "hub_model_";

export function getSelectedModel(appSlug: string): string {
  if (typeof window === "undefined") return DEFAULT_IMAGE_MODEL;
  const stored = window.localStorage.getItem(STORAGE_PREFIX + appSlug);
  if (stored && IMAGE_MODELS.some((m) => m.id === stored)) return stored;
  return DEFAULT_IMAGE_MODEL;
}

export function setSelectedModel(appSlug: string, modelId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + appSlug, modelId);
}
