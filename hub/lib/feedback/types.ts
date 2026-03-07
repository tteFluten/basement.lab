export interface Point { x: number; y: number }
export interface DrawingPath { points: Point[]; color: string; width: number }

export type SessionType = "video" | "image" | "url";

export interface FeedbackProject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  linkedProjectId: string | null;
  linkedProjectName: string | null;
  createdAt: number;
  sessionCount?: number;
  thumbVideoUrl?: string | null;
  thumbThumbnailUrl?: string | null;
  isMember?: boolean;
}

export interface FeedbackSession {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  version: string | null;
  sessionType: SessionType;
  videoUrl: string | null;    // also stores image URL for image sessions
  sourceUrl: string | null;   // URL for url sessions
  thumbnailUrl: string | null;
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
  xPct?: number | null;
  yPct?: number | null;
  screenshotUrl?: string | null;
  authorName: string;
  authorId: string | null;
  anonToken: string | null;
  createdAt: number;
  updatedAt: number;
}
