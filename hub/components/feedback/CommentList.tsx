"use client";

import { useState } from "react";
import { Clock, Edit2, Trash2, Check, X } from "lucide-react";
import type { FeedbackComment } from "@/lib/feedback/types";

interface CommentListProps {
  comments: FeedbackComment[];
  currentUserId: string | null;
  anonToken: string | null;
  onCommentClick: (timestampS: number) => void;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function formatTime(s: number) {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CommentList({
  comments,
  currentUserId,
  anonToken,
  onCommentClick,
  onEdit,
  onDelete,
}: CommentListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  function isOwner(c: FeedbackComment) {
    if (currentUserId && c.authorId === currentUserId) return true;
    if (anonToken && c.anonToken === anonToken) return true;
    return false;
  }

  async function handleSaveEdit(id: string) {
    setSavingId(id);
    try {
      await onEdit(id, editText);
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setSavingId(id);
    try {
      await onDelete(id);
    } finally {
      setSavingId(null);
    }
  }

  const sorted = [...comments].sort((a, b) => a.timestampS - b.timestampS);

  return (
    <div className="flex flex-col h-full border-l border-border bg-bg w-80 shrink-0">
      <div className="p-4 border-b border-border">
        <h2 className="text-xs font-mono uppercase text-fg-muted tracking-widest">
          Feedback Log
          {comments.length > 0 && (
            <span className="ml-2 text-fg">{comments.length}</span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-fg-muted text-xs font-mono">
            No feedback yet.
            <br />
            Pause the video to add a comment.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((c) => {
              const owner = isOwner(c);
              const isEditing = editingId === c.id;
              const isBusy = savingId === c.id;

              return (
                <div key={c.id} className="p-4 hover:bg-bg-muted transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => onCommentClick(c.timestampS)}
                      className="flex items-center gap-2 text-xs font-mono text-fg-muted hover:text-fg transition-colors"
                    >
                      <Clock size={12} />
                      {formatTime(c.timestampS)}
                    </button>
                    <div className="flex items-center gap-1">
                      {c.drawing && (
                        <span className="flex items-center gap-1 text-[10px] font-mono uppercase text-fg-muted border border-border px-1.5 py-0.5">
                          <Edit2 size={10} />
                          Drawing
                        </span>
                      )}
                      {owner && !isEditing && (
                        <>
                          <button
                            onClick={() => { setEditingId(c.id); setEditText(c.text); }}
                            disabled={isBusy}
                            className="p-1 text-fg-muted hover:text-fg transition-colors disabled:opacity-40"
                            title="Edit"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={isBusy}
                            className="p-1 text-fg-muted hover:text-red-400 transition-colors disabled:opacity-40"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-bg-muted border border-border p-2 text-sm text-fg focus:outline-none focus:border-fg-muted resize-none font-mono min-h-[60px]"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="p-1 text-fg-muted hover:text-fg" title="Cancel">
                          <X size={14} />
                        </button>
                        <button
                          onClick={() => handleSaveEdit(c.id)}
                          disabled={isBusy}
                          className="p-1 text-fg-muted hover:text-fg disabled:opacity-40"
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-fg font-mono leading-relaxed break-words">{c.text}</p>
                  )}

                  <div className="mt-2 text-[10px] text-fg-muted font-mono uppercase">{c.authorName}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
