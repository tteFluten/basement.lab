
import { ArtConfig } from './types';

export const DEFAULT_CONFIG: ArtConfig = {
  layout: 'network',
  gridLayout: 'concentric',
  zoom: 1.0,
  hubPositions: [{ x: 1000, y: 1000 }],
  hubSize: 10,
  hubShape: 'square',
  dotShape: 'circle',
  showHub: true,
  lineCount: 15,
  extraDensity: 1,
  thickness: 0.8,
  lineOpacity: 0.8,
  length: 600,
  spread: 120,
  curvature: 1.0,
  asymmetry: 0,
  noise: 0,
  noiseScale: 1.0,
  dotProbability: 5.0,
  dotSize: 1.5,
  shadowIntensity: 0.15,
  shadowBlur: 4,
  shadowAngle: 45,
  shadowDistance: 4,
  label: 'STATION_PRIME',
  theme: 'dark',
  manualSeed: '7',
  isAnimated: false,
  animationSpeed: 1.0,
  parallaxIntensity: 0.2
};

export const THEMES = {
  dark: {
    bg: '#000000',
    line: '#FFFFFF',
    dot: '#FFFFFF',
    text: '#FFFFFF',
    hub: '#FFFFFF',
    shadow: 'rgba(0, 0, 0, 0.9)'
  },
  light: {
    bg: '#FFFFFF',
    line: '#000000',
    dot: '#000000',
    text: '#000000',
    hub: '#000000',
    shadow: 'rgba(0, 0, 0, 0.3)'
  }
};
