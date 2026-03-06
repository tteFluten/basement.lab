"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, Film } from "lucide-react";
import { VideoPlayer } from "@/components/feedback/VideoPlayer";
import { CommentList } from "@/components/feedback/CommentList";
import type { FeedbackSession, FeedbackComment, DrawingPath } from "@/lib/feedback/types";

const ANON_COOKIE = "fb_anon";
const ANON_NAME_KEY = "fb_anon_name";

function getAnonToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ANON_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getOrPromptAnonName(): string {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(ANON_NAME_KEY) : null;
  if (stored) return stored;
  const name = window.prompt("Your name (shown on feedback):") ?? "";
  const trimmed = name.trim() || "Anonymous";
  localStorage.setItem(ANON_NAME_KEY, trimmed);
  return trimmed;
}

export default function ShareFeedbackPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [fbSession, setFbSession] = useState<FeedbackSession | null>(null);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [anonToken, setAnonToken] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [fps, setFps] = useState<number | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [overlayDrawing, setOverlayDrawing] = useState<DrawingPath[] | null>(null);

  const authorName =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(ANON_NAME_KEY) ?? "Anonymous"
      : "Anonymous";

  useEffect(() => { setAnonToken(getAnonToken()); }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/feedback/sessions/${sessionId}`),
      fetch(`/api/feedback/sessions/${sessionId}/comments`),
    ]).then(async ([sessionRes, commentsRes]) => {
      if (!sessionRes.ok) { setNotFound(true); setLoading(false); return; }
      setFbSession(await sessionRes.json());
      if (commentsRes.ok) {
        const data = await commentsRes.json();
        setComments(data.comments ?? []);
      }
      setLoading(false);
    });
  }, [sessionId]);

  const handleAddComment = useCallback(async (data: {
    timestampS: number;
    text: string;
    drawing?: DrawingPath[];
    authorName: string;
  }) => {
    const resolvedName = getOrPromptAnonName();
    const res = await fetch(`/api/feedback/sessions/${sessionId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestampS: data.timestampS,
        text: data.text,
        drawing: data.drawing ?? null,
        authorName: resolvedName,
      }),
    });
    if (!res.ok) throw new Error("Failed to save comment");
    const comment = await res.json();
    setComments((prev) => [...prev, comment]);
    setOverlayDrawing(null);
    setSelectedCommentId(null);
    const token = getAnonToken();
    if (token && !anonToken) setAnonToken(token);
  }, [sessionId, anonToken]);

  const handleEdit = useCallback(async (id: string, text: string) => {
    const res = await fetch(`/api/feedback/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("Failed to edit");
    const updated = await res.json();
    setComments((prev) => prev.map((c) => c.id === id ? { ...c, text: updated.text, updatedAt: updated.updatedAt } : c));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/feedback/comments/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleCommentClick = useCallback((timestampS: number, id: string, drawing?: DrawingPath[] | null) => {
    setSeekTo(timestampS);
    setTimeout(() => setSeekTo(null), 100);
    setOverlayDrawing(drawing ?? null);
    setSelectedCommentId(id);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh]">
      <Loader2 size={20} className="animate-spin text-fg-muted" />
    </div>
  );

  if (notFound || !fbSession) return (
    <div className="flex flex-col items-center justify-center h-[80vh] gap-3 text-fg-muted">
      <Film size={36} strokeWidth={1} className="opacity-40" />
      <p className="text-sm font-mono">This session doesn&apos;t exist or has been removed.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-muted">
        <h1 className="text-sm font-mono text-fg flex-1 truncate">{fbSession.title}</h1>
        <span className="text-xs font-mono text-fg-muted/50 shrink-0">feedback</span>
      </div>

      {/* Body */}
      {fbSession.videoUrl ? (
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto bg-[#0d0d0d] flex flex-col justify-start">
            <div className="p-4 max-w-5xl mx-auto w-full">
              <VideoPlayer
                src={fbSession.videoUrl}
                commentMarkers={comments.map((c) => ({ id: c.id, timestampS: c.timestampS }))}
                seekTo={seekTo}
                overlayDrawing={overlayDrawing}
                authorName={authorName}
                onAddComment={handleAddComment}
                onFpsDetected={setFps}
              />
            </div>
          </div>
          {showComments && (
            <CommentList
              comments={comments}
              currentUserId={null}
              anonToken={anonToken}
              fps={fps}
              selectedCommentId={selectedCommentId}
              onCommentClick={handleCommentClick}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-fg-muted gap-3">
          <Film size={40} strokeWidth={1} className="opacity-40" />
          <p className="text-sm font-mono">No video attached to this session.</p>
        </div>
      )}
    </div>
  );
}
