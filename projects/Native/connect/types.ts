
export interface ArtConfig {
  layout: 'horizon' | 'radial' | 'network' | 'grid';
  gridLayout: 'concentric' | 'rectangular' | 'triangular' | 'spiral' | 'honeycomb';
  zoom: number;
  hubPositions: Point[];
  hubSize: number;
  hubShape: 'square' | 'circle' | 'diamond' | 'pill';
  dotShape: 'circle' | 'square' | 'cross' | 'plus';
  showHub: boolean;
  lineCount: number;
  extraDensity: number;
  thickness: number;
  lineOpacity: number;
  length: number;
  spread: number;
  curvature: number;
  asymmetry: number;
  noise: number;
  noiseScale: number;
  dotProbability: number;
  dotSize: number;
  shadowIntensity: number;
  shadowBlur: number;
  shadowAngle: number;
  shadowDistance: number;
  label: string;
  theme: 'dark' | 'light';
  manualSeed: string;
  // Dynamic properties
  isAnimated: boolean;
  animationSpeed: number;
  parallaxIntensity: number;
}

export interface Point {
  x: number;
  y: number;
}
