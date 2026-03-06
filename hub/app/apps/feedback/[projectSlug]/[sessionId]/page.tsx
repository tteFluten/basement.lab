"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, Film } from "lucide-react";
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
  const name = window.prompt("Your name (shown on feedback):", "") ?? "";
  const trimmed = name.trim() || "Anonymous";
  localStorage.setItem(ANON_NAME_KEY, trimmed);
  return trimmed;
}

export default function SessionPage() {
  const { projectSlug, sessionId } = useParams<{ projectSlug: string; sessionId: string }>();
  const { data: authSession } = useSession();
  const [fbSession, setFbSession] = useState<FeedbackSession | null>(null);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [anonToken, setAnonToken] = useState<string | null>(null);

  const currentUserId = authSession?.user?.id ?? null;
  const authorName = currentUserId
    ? (authSession?.user?.name || authSession?.user?.email || "User")
    : (typeof localStorage !== "undefined" ? localStorage.getItem(ANON_NAME_KEY) ?? "Anonymous" : "Anonymous");

  useEffect(() => {
    setAnonToken(getAnonToken());
  }, []);

  const loadSession = useCallback(async () => {
    const [sessionRes, commentsRes] = await Promise.all([
      fetch(`/api/feedback/sessions/${sessionId}`),
      fetch(`/api/feedback/sessions/${sessionId}/comments`),
    ]);
    if (sessionRes.ok) setFbSession(await sessionRes.json());
    if (commentsRes.ok) {
      const data = await commentsRes.json();
      setComments(data.comments ?? []);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const handleAddComment = useCallback(async (data: {
    timestampS: number;
    text: string;
    drawing?: DrawingPath[];
    authorName: string;
  }) => {
    const resolvedName = currentUserId ? data.authorName : getOrPromptAnonName();
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
    if (res.ok) {
      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
      // Update anon token from cookie if just set
      const token = getAnonToken();
      if (token && !anonToken) setAnonToken(token);
    }
  }, [sessionId, currentUserId, anonToken]);

  const handleEdit = useCallback(async (id: string, text: string) => {
    const res = await fetch(`/api/feedback/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const updated = await res.json();
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, text: updated.text, updatedAt: updated.updatedAt } : c));
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/feedback/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  }, []);

  const handleCommentClick = useCallback((timestampS: number) => {
    setSeekTo(timestampS);
    setTimeout(() => setSeekTo(null), 100);
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center min-h-full">
      <Loader2 size={20} className="animate-spin text-fg-muted" />
    </div>
  );

  if (!fbSession) return (
    <div className="p-6 text-fg-muted text-sm font-mono">Session not found.</div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-muted">
        {projectSlug && (
          <Link href={`/apps/feedback/${projectSlug}`} className="text-fg-muted hover:text-fg transition-colors">
            <ArrowLeft size={16} />
          </Link>
        )}
        <h1 className="text-sm font-mono text-fg flex-1 truncate">{fbSession.title}</h1>
        <span className="text-xs text-fg-muted font-mono">{comments.length} comments</span>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {fbSession.videoUrl ? (
          <>
            <div className="flex-1 flex items-center justify-center bg-black p-6 overflow-y-auto">
              <VideoPlayer
                src={fbSession.videoUrl}
                commentMarkers={comments.map((c) => ({ id: c.id, timestampS: c.timestampS }))}
                seekTo={seekTo}
                authorName={authorName}
                onAddComment={handleAddComment}
              />
            </div>
            <CommentList
              comments={comments}
              currentUserId={currentUserId}
              anonToken={anonToken}
              onCommentClick={handleCommentClick}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-fg-muted gap-3">
            <Film size={40} strokeWidth={1} className="opacity-40" />
            <p className="text-sm font-mono">No video attached to this session.</p>
          </div>
        )}
      </div>
    </div>
  );
}
