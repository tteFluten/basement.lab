
export interface RenderJob {
  id: string;
  previewUrl: string;
  previewBase64: string;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
}

export interface RenderConfig {
  prompt: string;
  referenceImageBase64?: string;
  referenceImageUrl?: string;
}

// Fixed: The environment already provides a global AIStudio interface and window.aistudio property.
// We remove our local inline declaration to avoid "identical modifiers" and "same type" collision errors.
// This resolves the error where multiple declarations of 'aistudio' on the Window interface conflicted.
