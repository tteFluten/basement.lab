
export interface ImageFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  resultUrl?: string;
  error?: string;
}

export interface StylingOptions {
  matchClothingStyle: boolean;
  matchPose: boolean;
  matchLighting: boolean;
  matchColorPalette: boolean;
  matchBackground: boolean;
  matchGraphicDetails: boolean;
}

export type AspectRatio = '1:1' | '4:3' | '16:9';
export type QualityLevel = 'standard' | 'high';

export interface ProcessingState {
  isProcessing: boolean;
  currentIndex: number;
  total: number;
}
