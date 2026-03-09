"use client";

import { useState, useMemo } from "react";
import { Clock, Edit2, Trash2, Check, X, PenTool, MessageSquare, MapPin, Globe, ListChecks, ArrowUpDown } from "lucide-react";
import type { FeedbackComment, DrawingPath, SessionType, CommentPriority } from "@/lib/feedback/types";

type FilterMode = "all" | "done" | "pending";
type SortMode = "order" | "priority";

interface CommentListProps {
  comments: FeedbackComment[];
  currentUserId: string | null;
  anonToken: string | null;
  fps?: number | null;
  sessionType?: SessionType;
  selectedCommentId?: string | null;
  onCommentClick: (timestampS: number, id: string, drawing?: DrawingPath[] | null) => void;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleCompleted?: (id: string, completed: boolean) => Promise<void>;
  onSetPriority?: (id: string, priority: CommentPriority) => Promise<void>;
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

const PRIORITY_LABELS: Record<CommentPriority, string> = { high: "H", medium: "M", low: "L" };

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function priorityBadgeClass(p: CommentPriority, isActive: boolean): string {
  if (isActive) return "bg-fg text-bg border-fg";
  if (p === "high") return "bg-red-500/20 text-red-500 border-red-500/40 hover:bg-red-500/30";
  if (p === "low") return "bg-fg-muted/20 text-fg-muted border-border hover:bg-fg-muted/30";
  return "bg-amber-500/20 text-amber-600 border-amber-500/40 hover:bg-amber-500/30";
}

export function CommentList({ comments, currentUserId, anonToken, fps, sessionType = "video", selectedCommentId, onCommentClick, onEdit, onDelete, onToggleCompleted, onSetPriority }: CommentListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("order");

  const hasFilterSort = (sessionType === "video" || sessionType === "image") && (onToggleCompleted || onSetPriority);

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

  const filteredAndSorted = useMemo(() => {
    let list = [...comments];
    if (filterMode === "done") list = list.filter((c) => c.completed);
    if (filterMode === "pending") list = list.filter((c) => !c.completed);
    list.sort((a, b) => {
      if (sortMode === "priority" && onSetPriority) {
        const diff = PRIORITY_ORDER[a.priority ?? "medium"] - PRIORITY_ORDER[b.priority ?? "medium"];
        if (diff !== 0) return diff;
      }
      return sessionType === "video" ? a.timestampS - b.timestampS : a.createdAt - b.createdAt;
    });
    return list;
  }, [comments, filterMode, sortMode, sessionType, onSetPriority]);

  // Map comment id → 1-based pin index (image sessions only)
  const pinIndex = sessionType === "image"
    ? new Map(filteredAndSorted.map((c, i) => [c.id, i + 1]))
    : null;

  return (
    <div className="flex flex-col w-80 shrink-0 border-l border-border bg-bg h-full">
      {/* Header */}
      <div className="shrink-0 flex flex-col gap-2 px-4 py-3 border-b border-border bg-bg-muted">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-fg-muted">Feedback</span>
          {comments.length > 0 && (
            <span className="text-xs font-mono bg-bg border border-border text-fg px-2 py-0.5">{comments.length}</span>
          )}
        </div>
        {hasFilterSort && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex border border-border">
              {(["all", "pending", "done"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterMode(f)}
                  className={`px-2 py-0.5 text-[10px] font-mono transition-colors border-r border-border last:border-r-0 ${
                    filterMode === f ? "bg-fg text-bg" : "text-fg-muted hover:text-fg hover:bg-bg-muted"
                  }`}
                  title={f === "all" ? "All" : f === "done" ? "Done only" : "Pending only"}
                >
                  {f === "all" ? "All" : f === "done" ? "Done" : "Todo"}
                </button>
              ))}
            </div>
            {onSetPriority && (
              <button
                type="button"
                onClick={() => setSortMode((s) => (s === "order" ? "priority" : "order"))}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono border border-border text-fg-muted hover:text-fg transition-colors"
                title={sortMode === "order" ? "Sort by priority (H first)" : "Sort by order"}
              >
                {sortMode === "order" ? <ArrowUpDown size={10} /> : <ListChecks size={10} />}
                {sortMode === "order" ? "1→n" : "H→L"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
            <MessageSquare size={28} strokeWidth={1} className="text-fg-muted opacity-40" />
            <p className="text-xs font-mono text-fg-muted">No feedback yet</p>
            <p className="text-[11px] text-fg-muted/60">
              {sessionType === "image" ? "Click on the image to add a pin annotation" :
               sessionType === "review" ? "Use Review session to add cards (paste/upload, draw, comment)" :
               "Pause the video and click Comment or Annotate"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredAndSorted.map((c) => {
              const owner = isOwner(c);
              const isEditing = editingId === c.id;
              const isBusy = busyId === c.id;
              const isSelected = selectedCommentId === c.id;
              const hasDrawing = c.drawing && Array.isArray(c.drawing) && c.drawing.length > 0;

              return (
                <div
                  key={c.id}
                  className={`group px-4 py-3.5 transition-colors cursor-pointer ${
                    isSelected ? "bg-white text-black border-l-2 border-l-black" : "hover:bg-bg-muted/50 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => !isEditing && onCommentClick(c.timestampS, c.id, hasDrawing ? c.drawing : null)}
                >
                  {/* Top row: position indicator + actions */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`flex items-center gap-1.5 text-xs font-mono flex-wrap ${isSelected ? "text-black/70" : "text-fg-muted"}`}>
                      {(sessionType === "video" || sessionType === "image") && onToggleCompleted && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onToggleCompleted(c.id, !c.completed); }}
                          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            c.completed ? "bg-green-500/30 border-green-500/50" : "border-border hover:border-fg-muted"
                          } ${isSelected ? "text-black" : ""}`}
                          title={c.completed ? "Mark pending" : "Mark done"}
                        >
                          {c.completed && <Check size={10} strokeWidth={2.5} />}
                        </button>
                      )}
                      {sessionType === "video" ? (
                        <>
                          <Clock size={11} />
                          <span className="tabular-nums">
                            {fps ? formatSmpte(c.timestampS, Math.round(fps)) : formatTime(c.timestampS)}
                          </span>
                        </>
                      ) : sessionType === "image" ? (
                        <>
                          {pinIndex && (
                            <span className="inline-flex items-center justify-center w-4 h-4 bg-fg text-bg text-[9px] font-bold shrink-0">
                              {pinIndex.get(c.id) ?? "·"}
                            </span>
                          )}
                          {c.xPct != null && (
                            <span className="tabular-nums text-fg-muted/60">
                              {Math.round((c.xPct ?? 0) * 100)}%, {Math.round((c.yPct ?? 0) * 100)}%
                            </span>
                          )}
                        </>
                      ) : sessionType === "review" ? (
                        <Globe size={11} />
                      ) : null}
                      {(sessionType === "video" || sessionType === "image") && onSetPriority && (
                        <span className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                          {(["high", "medium", "low"] as CommentPriority[]).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => onSetPriority(c.id, p)}
                              className={`shrink-0 w-5 h-5 flex items-center justify-center text-[9px] font-bold border transition-colors ${priorityBadgeClass(p, (c.priority ?? "medium") === p)}`}
                              title={`Priority: ${p}`}
                            >
                              {PRIORITY_LABELS[p]}
                            </button>
                          ))}
                        </span>
                      )}
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
                      {c.screenshotUrl && (
                        <img
                          src={c.screenshotUrl}
                          alt="Screenshot"
                          className="w-full h-24 object-cover object-top mb-2 border border-border/50 opacity-80 hover:opacity-100 transition-opacity"
                        />
                      )}
                      {c.text && (
                        <p className={`text-[13px] font-mono leading-relaxed break-words mb-2.5 ${c.completed ? "line-through opacity-70" : ""} ${isSelected ? "text-black" : "text-fg"}`}>{c.text}</p>
                      )}
                      {!c.text && hasDrawing && (
                        <p className={`text-[13px] font-mono italic mb-2.5 ${c.completed ? "line-through opacity-70" : "text-fg-muted"}`}>Annotation only — click to view</p>
                      )}
                    </>
                  )}

                  {/* Author */}
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-mono shrink-0 ${isSelected ? "bg-black/10 border-black/30 text-black/70" : "bg-bg-muted border-border text-fg-muted"}`}>
                      {initials(c.authorName)}
                    </div>
                    <span className={`text-[11px] font-mono truncate ${isSelected ? "text-black/70" : "text-fg-muted/70"}`}>{c.authorName}</span>
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
