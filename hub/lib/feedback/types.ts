export interface Point { x: number; y: number }
export interface DrawingPath { points: Point[]; color: string; width: number }

export interface FeedbackProject {
  id: string;
  slug: string;
  name: string;
  ownerId: string | null;
  createdAt: number;
  sessionCount?: number;
}

export interface FeedbackSession {
  id: string;
  projectId: string;
  title: string;
  videoUrl: string | null;
  durationS: number | null;
  createdAt: number;
  commentCount?: number;
}

export interface FeedbackComment {
  id: string;
  sessionId: string;
  timestampS: number;
  text: string;
  drawing?: DrawingPath[] | null;
  authorName: string;
  authorId: string | null;
  anonToken: string | null;
  createdAt: number;
  updatedAt: number;
}
