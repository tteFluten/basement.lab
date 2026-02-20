
export interface Variation {
  id: number;
  prompt: string;
  type: 'camera' | 'narrative';
}

export interface SceneAnalysis {
  description: string;
  actor: string;
  environment: string;
  style: string;
  lighting: string;
}

export interface NarrativeSuggestion {
  title: string;
  description: string;
}

export interface GridState {
  imageUrl: string | null;
  variations: Variation[];
  selectedIndex: number | null;
}
