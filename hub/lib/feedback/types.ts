export interface Point { x: number; y: number }
export interface DrawingPath { points: Point[]; color: string; width: number }

export interface FeedbackProject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: number;
  sessionCount?: number;
  thumbVideoUrl?: string | null;
}

export interface FeedbackSession {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
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
