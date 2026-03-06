"use client";

import { useState } from "react";
import { Clock, Edit2, Trash2, Check, X, PenTool, MessageSquare } from "lucide-react";
import type { FeedbackComment, DrawingPath } from "@/lib/feedback/types";

interface CommentListProps {
  comments: FeedbackComment[];
  currentUserId: string | null;
  anonToken: string | null;
  fps?: number | null;
  selectedCommentId?: string | null;
  onCommentClick: (timestampS: number, id: string, drawing?: DrawingPath[] | null) => void;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function formatTime(s: number) {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatSmpte(s: number, fps: number) {
  const totalFrames = Math.round(s * fps);
  const f = totalFrames % fps;
  const totalSecs = Math.floor(totalFrames / fps);
  return `${formatTime(totalSecs)} · f${f}`;
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function CommentList({ comments, currentUserId, anonToken, fps, selectedCommentId, onCommentClick, onEdit, onDelete }: CommentListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function isOwner(c: FeedbackComment) {
    if (currentUserId && c.authorId === currentUserId) return true;
    if (anonToken && c.anonToken === anonToken) return true;
    return false;
  }

  async function handleSaveEdit(id: string) {
    setBusyId(id);
    try { await onEdit(id, editText); setEditingId(null); }
    finally { setBusyId(null); }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try { await onDelete(id); }
    finally { setBusyId(null); }
  }

  const sorted = [...comments].sort((a, b) => a.timestampS - b.timestampS);

  return (
    <div className="flex flex-col w-80 shrink-0 border-l border-border bg-bg h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-bg-muted">
        <span className="text-xs font-mono uppercase tracking-widest text-fg-muted">Feedback</span>
        {comments.length > 0 && (
          <span className="text-xs font-mono bg-bg border border-border text-fg px-2 py-0.5">{comments.length}</span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
            <MessageSquare size={28} strokeWidth={1} className="text-fg-muted opacity-40" />
            <p className="text-xs font-mono text-fg-muted">No feedback yet</p>
            <p className="text-[11px] text-fg-muted/60">Pause the video and click Comment or Annotate</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((c) => {
              const owner = isOwner(c);
              const isEditing = editingId === c.id;
              const isBusy = busyId === c.id;
              const isSelected = selectedCommentId === c.id;
              const hasDrawing = c.drawing && Array.isArray(c.drawing) && c.drawing.length > 0;

              return (
                <div
                  key={c.id}
                  className={`group px-4 py-3.5 transition-colors cursor-pointer ${
                    isSelected ? "bg-bg-muted border-l-2 border-l-fg" : "hover:bg-bg-muted/50 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => !isEditing && onCommentClick(c.timestampS, c.id, hasDrawing ? c.drawing : null)}
                >
                  {/* Top row: timestamp + actions */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-fg-muted">
                      <Clock size={11} />
                      <span className="tabular-nums">
                        {fps ? formatSmpte(c.timestampS, Math.round(fps)) : formatTime(c.timestampS)}
                      </span>
                      {hasDrawing && (
                        <span title="Has annotation" className={`transition-colors ${isSelected ? "text-fg" : "text-fg-muted/50"}`}>
                          <PenTool size={10} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {owner && !isEditing && (
                        <>
                          <button
                            onClick={() => { setEditingId(c.id); setEditText(c.text); }}
                            disabled={isBusy}
                            className="p-1 text-fg-muted hover:text-fg transition-colors disabled:opacity-40"
                            title="Edit"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={isBusy}
                            className="p-1 text-fg-muted hover:text-red-400 transition-colors disabled:opacity-40"
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  {isEditing ? (
                    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-bg-muted border border-border px-2.5 py-2 text-sm text-fg focus:outline-none focus:border-fg-muted resize-none font-mono min-h-[64px] text-[13px]"
                        autoFocus
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => setEditingId(null)} className="p-1 text-fg-muted hover:text-fg transition-colors">
                          <X size={13} />
                        </button>
                        <button
                          onClick={() => handleSaveEdit(c.id)}
                          disabled={isBusy}
                          className="p-1 text-fg-muted hover:text-fg disabled:opacity-40 transition-colors"
                        >
                          <Check size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {c.text && (
                        <p className="text-[13px] text-fg font-mono leading-relaxed break-words mb-2.5">{c.text}</p>
                      )}
                      {!c.text && hasDrawing && (
                        <p className="text-[13px] text-fg-muted font-mono italic mb-2.5">Annotation only — click to view</p>
                      )}
                    </>
                  )}

                  {/* Author */}
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-bg-muted border border-border flex items-center justify-center text-[9px] font-mono text-fg-muted shrink-0">
                      {initials(c.authorName)}
                    </div>
                    <span className="text-[11px] text-fg-muted/70 font-mono truncate">{c.authorName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
