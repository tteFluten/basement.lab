
export enum AppState {
  KEY_SELECTION = 'KEY_SELECTION',
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  EDITING = 'EDITING',
  UPSCALING = 'UPSCALING'
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  isGrid: boolean;
  gridSize: number; // Storing this to know how to split the image later
  resolution: '1K' | '2K' | '4K';
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
