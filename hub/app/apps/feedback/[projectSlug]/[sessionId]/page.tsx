"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Film, MessageSquare, Share2, Check, X, Pencil, Loader2, Hash } from "lucide-react";
import { FeedbackLoader } from "@/components/feedback/FeedbackLoader";
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

export default function SessionPage() {
  const { projectSlug, sessionId } = useParams<{ projectSlug: string; sessionId: string }>();
  const { data: authSession } = useSession();
  const [fbSession, setFbSession] = useState<FeedbackSession | null>(null);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [anonToken, setAnonToken] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [fps, setFps] = useState<number | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [overlayDrawing, setOverlayDrawing] = useState<DrawingPath[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  const currentUserId = authSession?.user?.id ?? null;
  const authorName = currentUserId
    ? (authSession?.user?.name || authSession?.user?.email || "User")
    : (typeof localStorage !== "undefined" ? localStorage.getItem(ANON_NAME_KEY) ?? "Anonymous" : "Anonymous");

  useEffect(() => { setAnonToken(getAnonToken()); }, []);

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
    if (!res.ok) throw new Error("Failed to save comment");
    const comment = await res.json();
    setComments((prev) => [...prev, comment]);
    setOverlayDrawing(null);
    setSelectedCommentId(null);
    const token = getAnonToken();
    if (token && !anonToken) setAnonToken(token);
  }, [sessionId, currentUserId, anonToken]);

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

  const handleSaveMeta = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/feedback/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), description: editDesc }),
      });
      if (res.ok) {
        const updated = await res.json();
        setFbSession((prev) => prev ? { ...prev, title: updated.title, description: updated.description } : prev);
        setEditingMeta(false);
      }
    } finally {
      setSavingMeta(false);
    }
  }, [sessionId, editTitle, editDesc]);

  const handleCommentClick = useCallback((timestampS: number, id: string, drawing?: DrawingPath[] | null) => {
    setSeekTo(timestampS);
    setTimeout(() => setSeekTo(null), 100);
    setOverlayDrawing(drawing ?? null);
    setSelectedCommentId(id);
  }, []);

  if (loading) return <FeedbackLoader />;

  if (!fbSession) return (
    <div className="p-6 text-fg-muted text-sm font-mono">Session not found.</div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border bg-bg-muted">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Link href={`/apps/feedback/${projectSlug}`} className="text-fg-muted hover:text-fg transition-colors shrink-0">
            <ArrowLeft size={15} />
          </Link>
          {editingMeta ? (
            <form onSubmit={handleSaveMeta} className="flex-1 flex items-center gap-2 min-w-0">
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 min-w-0 bg-bg border border-border px-2.5 py-1 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted"
                placeholder="Session title"
              />
              <button type="button" onClick={() => setEditingMeta(false)}
                className="shrink-0 p-1 text-fg-muted hover:text-fg transition-colors">
                <X size={13} />
              </button>
              <button type="submit" disabled={savingMeta || !editTitle.trim()}
                className="shrink-0 p-1 text-fg-muted hover:text-fg disabled:opacity-40 transition-colors">
                {savingMeta ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h1 className="text-sm font-mono text-fg truncate">{fbSession.title}</h1>
              {fbSession.version && (
                <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono border border-border text-fg-muted/60 bg-bg-muted">
                  <Hash size={8} />{fbSession.version}
                </span>
              )}
              <button
                onClick={() => { setEditingMeta(true); setEditTitle(fbSession.title); setEditDesc(fbSession.description ?? ""); }}
                className="shrink-0 p-0.5 text-fg-muted/30 hover:text-fg-muted transition-colors"
                title="Edit title"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={async () => {
                const url = `${window.location.origin}/share/feedback/${sessionId}`;
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
              title="Copy share link"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Share2 size={12} />}
              {copied ? "Copied" : "Share"}
            </button>
            <button
              onClick={() => setShowComments((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase border transition-colors ${
                showComments ? "border-border text-fg-muted hover:text-fg" : "border-fg-muted text-fg"
              }`}
              title="Toggle feedback panel"
            >
              <MessageSquare size={12} />
              {comments.length}
            </button>
          </div>
        </div>
        {/* Description row */}
        {editingMeta && (
          <div className="px-4 pb-3">
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full bg-bg border border-border px-2.5 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted resize-none min-h-[48px]"
              placeholder="Description (optional)"
            />
          </div>
        )}
        {!editingMeta && fbSession.description && (
          <div className="px-4 pb-2.5 text-xs text-fg-muted">{fbSession.description}</div>
        )}
      </div>

      {/* ── Body ── */}
      {fbSession.videoUrl ? (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Video column */}
          <div className="flex-1 overflow-y-auto bg-[#0d0d0d] flex flex-col">
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

          {/* Comments panel */}
          {showComments && (
            <CommentList
              comments={comments}
              currentUserId={currentUserId}
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
