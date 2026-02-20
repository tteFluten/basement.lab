
import React from 'react';

export type GenerationMode = 'text_only' | 'start_image' | 'start_end_image';
export type Engine = 'veo' | 'kling' | 'luma' | 'runway' | 'gen3';

export interface OptionItem {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  icon?: React.ReactNode;
  technicalTerm: string;
}

export interface PromptConfig {
  actionDescription: string;
  mode: GenerationMode;
  engine: Engine;
  cameraType: string;
  movement: string;
  lens: string;
  lighting: string;
  style: string;
  stillStyle: string;
  styleWeight: number; // Added: Control for aesthetic intensity
  aspectRatio: string;
  resolution: string;
  startImage?: string;
  endImage?: string;
}
