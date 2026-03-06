export interface Point {
  x: number;
  y: number;
}

export interface DrawingPath {
  points: Point[];
  color: string;
  width: number;
}

export interface Comment {
  id: string;
  timestamp: number; // in seconds
  text: string;
  author: string;
  createdAt: number;
  drawing?: DrawingPath[]; // Array of paths
}
