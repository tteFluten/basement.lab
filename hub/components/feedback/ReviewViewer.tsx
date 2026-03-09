"use client";

import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import {
  ExternalLink, Plus, Trash2, Check, Loader2, LayoutGrid, Upload, List, X, MapPin, ArrowUpDown, ListChecks, MessageSquare,
} from "lucide-react";
import type { FeedbackComment, CommentPriority } from "@/lib/feedback/types";
import { ImageAnnotator } from "@/components/feedback/ImageAnnotator";

function formatCommentDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function uploadImageForReview(file: File | Blob, filename = "paste.png"): Promise<string | null> {
  const contentType = file.type || "image/png";
  const res = await fetch("/api/feedback/upload/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType, size: file.size }),
  });
  if (!res.ok) return null;
  const init = await res.json() as { mode: string; uploadUrl?: string; publicUrl?: string };
  if (init.mode === "r2" && init.uploadUrl && init.publicUrl) {
    const putRes = await fetch(init.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
    return putRes.ok ? init.publicUrl : null;
  }
  if (init.mode === "blob") {
    const { upload } = await import("@vercel/blob/client");
    const fileToUpload = file instanceof File ? file : new File([file], filename, { type: file.type || "image/png" });
    const blob = await upload(filename, fileToUpload, { access: "public", handleUploadUrl: "/api/feedback/upload/image" });
    return blob.url;
  }
  return null;
}

/** One card = one screenshot; notes = comments with that screenshotUrl and xPct/yPct */
interface ReviewCard {
  screenshotUrl: string;
  /** All comments for this screenshot (main + notes) */
  comments: FeedbackComment[];
  /** Main comment (card title), e.g. the one without pin or the earliest */
  mainComment: FeedbackComment;
  /** Notes (pins) on this screenshot */
  notes: FeedbackComment[];
}

function buildCards(comments: FeedbackComment[]): ReviewCard[] {
  const byUrl = new Map<string, FeedbackComment[]>();
  for (const c of comments) {
    if (!c.screenshotUrl) continue;
    const list = byUrl.get(c.screenshotUrl) ?? [];
    list.push(c);
    byUrl.set(c.screenshotUrl, list);
  }
  const cards: ReviewCard[] = [];
  byUrl.forEach((list, screenshotUrl) => {
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    const notes = sorted.filter((c) => c.xPct != null && c.yPct != null);
    const mainComment = sorted.find((c) => c.xPct == null || c.yPct == null) ?? sorted[0];
    cards.push({ screenshotUrl, comments: sorted, mainComment, notes });
  });
  cards.sort((a, b) => a.mainComment.createdAt - b.mainComment.createdAt);
  return cards;
}

interface ReviewViewerProps {
  sourceUrl: string;
  sessionId: string;
  sessionTitle: string;
  comments: FeedbackComment[];
  selectedCommentId: string | null;
  authorName: string;
  onAddComment: (data: {
    timestampS: number;
    text: string;
    drawing?: { points: { x: number; y: number }[]; color: string; width: number }[];
    authorName: string;
    screenshotUrl?: string | null;
    xPct?: number | null;
    yPct?: number | null;
    priority?: CommentPriority;
  }) => Promise<void>;
  onSelectComment: (id: string | null) => void;
  onEditComment: (id: string, text: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  onToggleCompleted: (id: string, completed: boolean) => Promise<void>;
  onSetPriority?: (id: string, priority: CommentPriority) => Promise<void>;
}

export function ReviewViewer({
  sourceUrl,
  sessionTitle,
  comments,
  selectedCommentId,
  authorName,
  onAddComment,
  onSelectComment,
  onDeleteComment,
  onToggleCompleted,
  onSetPriority,
}: ReviewViewerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"list" | "cards" | "checklist">("list");
  const [addingCard, setAddingCard] = useState(false);
  const [pasteImage, setPasteImage] = useState<string | null>(null);
  const [pasteBlob, setPasteBlob] = useState<Blob | null>(null);
  const [cardTitle, setCardTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listPanelWidth, setListPanelWidth] = useState(360);
  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; w: number } | null>(null);
  const [selectedCardScreenshotUrl, setSelectedCardScreenshotUrl] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"date-newest" | "date-oldest">("date-newest");

  const cards = useMemo(() => buildCards(comments), [comments]);
  const sortedCards = useMemo(() => {
    const arr = [...cards];
    if (sortOrder === "date-oldest") return arr;
    return arr.reverse();
  }, [cards, sortOrder]);

  const selectedCard = selectedCardScreenshotUrl ? cards.find((c) => c.screenshotUrl === selectedCardScreenshotUrl) : null;
  const selectedNote = selectedCard && selectedCommentId
    ? selectedCard.notes.find((n) => n.id === selectedCommentId)
    : null;

  const MIN_LIST_WIDTH = 220;
  const MAX_LIST_WIDTH = 560;

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
    resizeStartRef.current = { x: e.clientX, w: listPanelWidth };
  }, [listPanelWidth]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const delta = e.clientX - start.x;
      const next = Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, start.w + delta));
      setListPanelWidth(next);
      resizeStartRef.current = { x: e.clientX, w: next };
    };
    const onUp = () => {
      setResizing(false);
      resizeStartRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!addingCard) return;
    const item = e.clipboardData?.items?.[0];
    if (!item || !item.type.startsWith("image/")) return;
    e.preventDefault();
    const blob = item.getAsFile();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPasteImage(url);
    setPasteBlob(blob);
  }, [addingCard]);

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    uploadImageForReview(file, file.name).then((url) => {
      setUploading(false);
      if (url) {
        setPasteImage(url);
        setPasteBlob(null);
        setAddingCard(true);
      }
      e.target.value = "";
    }).catch(() => setUploading(false));
  }, []);

  const handleStartAddCard = useCallback(() => {
    setAddingCard(true);
    setPasteImage(null);
    setPasteBlob(null);
    setCardTitle("");
  }, []);

  const handleCancelAddCard = useCallback(() => {
    setAddingCard(false);
    if (pasteImage && pasteBlob) URL.revokeObjectURL(pasteImage);
    setPasteImage(null);
    setPasteBlob(null);
    setCardTitle("");
  }, [pasteImage, pasteBlob]);

  const handleSaveCard = useCallback(async () => {
    if (!pasteImage && !pasteBlob) return;
    setSaving(true);
    try {
      let screenshotUrl: string | null = null;
      if (pasteBlob) {
        screenshotUrl = await uploadImageForReview(pasteBlob, "paste.png");
      } else if (pasteImage?.startsWith("http")) {
        screenshotUrl = pasteImage;
      }
      if (!screenshotUrl) {
        setSaving(false);
        return;
      }
      const text = cardTitle.trim() || "Screenshot";
      await onAddComment({
        timestampS: 0,
        text,
        authorName,
        screenshotUrl,
        xPct: null,
        yPct: null,
        priority: "medium",
      });
      if (pasteImage && pasteBlob) URL.revokeObjectURL(pasteImage);
      setAddingCard(false);
      setPasteImage(null);
      setPasteBlob(null);
      setCardTitle("");
      setSelectedCardScreenshotUrl(screenshotUrl);
    } finally {
      setSaving(false);
    }
  }, [pasteImage, pasteBlob, cardTitle, onAddComment, authorName]);

  const handleExportLinear = useCallback(() => {
    const lines = [`# ${sessionTitle}`, "", `Reference: ${sourceUrl}`, ""];
    sortedCards.forEach((card, i) => {
      lines.push(`## Screenshot ${i + 1}`);
      lines.push(card.mainComment.text || "Screenshot");
      if (card.screenshotUrl) lines.push(`Image: ${card.screenshotUrl}`);
      card.notes.forEach((n, j) => {
        const check = n.completed ? "[x]" : "[ ]";
        lines.push(`${check} ${j + 1}. ${n.text || "(note)"}`);
      });
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  }, [sessionTitle, sourceUrl, sortedCards]);

  const handleCloseCardDetail = useCallback(() => {
    setSelectedCardScreenshotUrl(null);
    onSelectComment(null);
  }, [onSelectComment]);

  const handleAddNoteOnCard = useCallback(async (data: {
    timestampS: number;
    text: string;
    drawing?: { points: { x: number; y: number }[]; color: string; width: number }[];
    authorName: string;
    xPct: number;
    yPct: number;
  }) => {
    if (!selectedCardScreenshotUrl) return;
    await onAddComment({
      ...data,
      screenshotUrl: selectedCardScreenshotUrl,
      priority: "medium",
    });
  }, [selectedCardScreenshotUrl, onAddComment]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-muted flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors shrink-0"
          >
            <ExternalLink size={12} />
            Open in new tab
          </a>
          <span className="text-[11px] font-mono text-fg-muted truncate max-w-[240px] sm:max-w-[360px]" title={sourceUrl}>
            {sourceUrl}
          </span>
        </div>
        <div className="flex items-center gap-0.5 border border-border">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono ${viewMode === "list" ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"}`}
            title="Compact list"
          >
            <List size={12} /> List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono ${viewMode === "cards" ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"}`}
            title="Cards"
          >
            <LayoutGrid size={12} /> Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("checklist")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono ${viewMode === "checklist" ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"}`}
            title="Checklist with notes tree"
          >
            <ListChecks size={12} /> Checklist
          </button>
        </div>
        <div className="flex items-center gap-1.5 border border-border px-2 py-1 bg-bg">
          <ArrowUpDown size={12} className="text-fg-muted shrink-0" />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            className="select-themed bg-bg text-xs font-mono text-fg focus:outline-none cursor-pointer min-w-[7rem]"
            title="Sort order"
          >
            <option value="date-newest">Newest first</option>
            <option value="date-oldest">Oldest first</option>
          </select>
        </div>
        <button
          type="button"
          onClick={handleExportLinear}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
        >
          Copy for Linear
        </button>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div
          className={`overflow-y-auto space-y-4 shrink-0 border-r border-border p-4 ${selectedCard ? "" : "flex-1"}`}
          style={selectedCard ? { width: listPanelWidth } : undefined}
        >
          {addingCard && !pasteImage && !uploading && (
            <div className="border border-dashed border-fg-muted/50 bg-bg-muted/50 p-6 text-center">
              <p className="text-xs font-mono text-fg-muted mb-2">Paste (Ctrl+V) or upload a screenshot</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-border text-fg-muted hover:text-fg"
                >
                  <Upload size={14} /> Upload image
                </button>
                <button type="button" onClick={handleCancelAddCard} className="text-xs text-fg-muted hover:text-fg">Cancel</button>
              </div>
            </div>
          )}

          {addingCard && (pasteImage || uploading) && (
            <div className="border border-border bg-bg-muted p-4 space-y-3">
              {uploading ? (
                <div className="flex items-center gap-2 text-fg-muted py-8 justify-center">
                  <Loader2 size={18} className="animate-spin" /> Uploading…
                </div>
              ) : (
                <>
                  <div className="relative max-w-full bg-black/20 border border-border overflow-hidden" style={{ maxHeight: 200 }}>
                    <img src={pasteImage!} alt="Paste" className="max-h-[200px] w-full object-contain block" />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-fg-muted block mb-1">Card title (optional)</label>
                    <input
                      type="text"
                      value={cardTitle}
                      onChange={(e) => setCardTitle(e.target.value)}
                      placeholder="Screenshot"
                      className="w-full bg-bg border border-border px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleCancelAddCard} className="px-3 py-1.5 text-xs border border-border text-fg-muted hover:text-fg">Cancel</button>
                    <button type="button" onClick={handleSaveCard} disabled={saving} className="px-3 py-1.5 text-xs bg-fg text-bg disabled:opacity-50">
                      {saving ? <Loader2 size={12} className="animate-spin inline" /> : <Check size={12} className="inline" />} Save card
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {!addingCard && (
            <button
              type="button"
              onClick={handleStartAddCard}
              className="flex items-center gap-2 px-4 py-3 border border-dashed border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors w-full justify-center"
            >
              <Plus size={14} /> Add card (paste or upload screenshot)
            </button>
          )}

          <div className={viewMode === "list" ? "space-y-0.5" : viewMode === "checklist" ? "space-y-1" : "space-y-2"}>
            {sortedCards.map((card) => {
              const isSelected = selectedCardScreenshotUrl === card.screenshotUrl;
              if (viewMode === "list") {
                return (
                  <div
                    key={card.screenshotUrl}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCardScreenshotUrl(isSelected ? null : card.screenshotUrl)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCardScreenshotUrl(isSelected ? null : card.screenshotUrl); } }}
                    className={`flex items-center gap-2 py-1.5 px-2 border-b border-border/50 cursor-pointer transition-colors hover:bg-bg-muted/80 ${isSelected ? "bg-white text-black" : ""}`}
                  >
                    <div className="shrink-0 w-10 h-7 overflow-hidden border border-border/50 flex items-center bg-black/20">
                      <img src={card.screenshotUrl} alt="" className="w-full h-full object-cover object-top" />
                    </div>
                    <span className={`flex-1 min-w-0 text-[11px] font-mono truncate ${isSelected ? "text-black" : "text-fg"}`}>{card.mainComment.text || "Screenshot"}</span>
                    <span className={`shrink-0 text-[10px] font-mono ${isSelected ? "text-black/70" : "text-fg-muted"}`}>{card.notes.length} note{card.notes.length !== 1 ? "s" : ""}</span>
                    <span className={`shrink-0 text-[10px] font-mono ${isSelected ? "text-black/60" : "text-fg-muted/80"}`} title={new Date(card.mainComment.createdAt).toLocaleString()}>
                      {formatCommentDate(card.mainComment.createdAt)}
                    </span>
                  </div>
                );
              }
              if (viewMode === "checklist") {
                const doneCount = card.notes.filter((n) => n.completed).length;
                return (
                  <div
                    key={card.screenshotUrl}
                    className="border border-border bg-bg-muted overflow-hidden"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCardScreenshotUrl(isSelected ? null : card.screenshotUrl)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCardScreenshotUrl(isSelected ? null : card.screenshotUrl); } }}
                      className={`flex items-center gap-2 p-2 cursor-pointer transition-colors hover:bg-bg-muted/80 ${isSelected ? "bg-white text-black" : ""}`}
                    >
                      <div className="shrink-0 w-8 h-6 overflow-hidden border border-border/50 flex items-center bg-black/20">
                        <img src={card.screenshotUrl} alt="" className="w-full h-full object-cover object-top" />
                      </div>
                      <span className={`flex-1 min-w-0 text-[11px] font-mono truncate ${isSelected ? "text-black" : "text-fg"}`}>{card.mainComment.text || "Screenshot"}</span>
                      <span className={`flex items-center gap-1 shrink-0 text-[10px] font-mono ${isSelected ? "text-black/70" : "text-fg-muted"}`}>
                        <Check size={10} className={doneCount === card.notes.length && card.notes.length > 0 ? "text-green-500" : "opacity-40"} />
                        {doneCount}/{card.notes.length}
                      </span>
                    </div>
                    {card.notes.length > 0 && (
                      <div className="border-t border-border/50 pl-2 pr-2 pb-2 pt-1 space-y-0.5">
                        {card.notes.map((note, i) => (
                          <div
                            key={note.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedCardScreenshotUrl(card.screenshotUrl);
                              onSelectComment(note.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedCardScreenshotUrl(card.screenshotUrl);
                                onSelectComment(note.id);
                              }
                            }}
                            className={`w-full flex items-center gap-2 py-1.5 px-2 text-left rounded-none transition-colors hover:bg-bg/50 cursor-pointer ${
                              selectedCommentId === note.id ? "bg-white text-black" : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleCompleted(note.id, !note.completed);
                              }}
                              className={`shrink-0 w-4 h-4 flex items-center justify-center border transition-colors ${selectedCommentId === note.id ? "border-black hover:border-black/80" : "border-border hover:border-fg-muted"}`}
                            >
                              {note.completed ? <Check size={10} className={selectedCommentId === note.id ? "text-black" : "text-fg"} /> : null}
                            </button>
                            <span className={`flex-1 min-w-0 text-[11px] font-mono truncate ${note.completed ? "line-through opacity-70" : ""} ${selectedCommentId === note.id ? "text-black" : "text-fg"}`}>
                              {note.text || `Note ${i + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div
                  key={card.screenshotUrl}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCardScreenshotUrl(isSelected ? null : card.screenshotUrl)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCardScreenshotUrl(isSelected ? null : card.screenshotUrl); } }}
                  className={`border border-border overflow-hidden transition-colors cursor-pointer hover:border-fg-muted/50 ${isSelected ? "bg-white text-black border-fg/50" : "bg-bg-muted"}`}
                >
                  <div className="flex items-center gap-2 p-2">
                    <div className="shrink-0 w-16 h-12 overflow-hidden border border-border/50 flex items-center bg-black/20">
                      <img src={card.screenshotUrl} alt="" className="w-full h-full object-cover object-top" />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className={`text-[12px] font-mono break-words line-clamp-2 ${isSelected ? "text-black" : "text-fg"}`}>{card.mainComment.text || "Screenshot"}</p>
                      <p className={`text-[10px] ${isSelected ? "text-black/70" : "text-fg-muted"}`}>{card.notes.length} note{card.notes.length !== 1 ? "s" : ""} · {formatCommentDate(card.mainComment.createdAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedCard && (
          <div
            role="separator"
            aria-label="Resize list width"
            onMouseDown={handleResizeStart}
            className="shrink-0 w-2 flex cursor-col-resize h-full relative group"
          >
            {/* Two vertical lines that fade at bottom */}
            <div
              className="absolute inset-0 flex justify-center gap-0.5"
              style={{
                maskImage: "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
              }}
            >
              <div className={`w-px h-full transition-colors ${resizing ? "bg-fg/50" : "group-hover:bg-fg/40 bg-fg/20"}`} />
              <div className={`w-px h-full transition-colors ${resizing ? "bg-fg/50" : "group-hover:bg-fg/40 bg-fg/20"}`} />
            </div>
          </div>
        )}

        {selectedCard && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-l border-border bg-bg-muted/30">
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-fg-muted">Screenshot · add notes (pins + draw)</span>
              </div>
              <button type="button" onClick={handleCloseCardDetail} className="p-1 text-fg-muted hover:text-fg" title="Close">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Notes list - always on the left, fixed position */}
              <div className="shrink-0 w-56 border-r border-border bg-bg flex flex-col overflow-hidden">
                <div className="shrink-0 px-3 py-2 border-b border-border flex items-center gap-1.5">
                  <MessageSquare size={11} className="text-fg-muted" />
                  <span className="text-[11px] font-mono text-fg-muted">Notes ({selectedCard.notes.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {selectedCard.notes.length === 0 ? (
                    <div className="px-3 py-6 text-center">
                      <p className="text-[11px] font-mono text-fg-muted">Click on image to add pins</p>
                    </div>
                  ) : (
                    selectedCard.notes.map((note, i) => {
                      const isSelected = selectedCommentId === note.id;
                      return (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() => onSelectComment(isSelected ? null : note.id)}
                          className={`w-full text-left px-3 py-2.5 transition-colors flex items-start gap-2 ${
                            isSelected ? "bg-white text-black border-l-2 border-l-black" : "hover:bg-bg-muted/50 border-l-2 border-l-transparent"
                          }`}
                        >
                          <span className={`shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold ${isSelected ? "bg-black text-white" : "bg-fg text-bg"}`}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12px] font-mono line-clamp-2 break-words ${note.completed ? "line-through opacity-70" : ""} ${isSelected ? "text-black" : "text-fg"}`}>
                              {note.text || "(no text)"}
                            </p>
                            {note.completed && (
                              <span className={`inline-flex items-center gap-0.5 mt-0.5 text-[10px] ${isSelected ? "text-black/70" : "text-fg-muted"}`}>
                                <Check size={10} /> Done
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                <ImageAnnotator
                  src={selectedCard.screenshotUrl}
                  comments={selectedCard.notes}
                  selectedCommentId={selectedCommentId}
                  overlayDrawing={selectedNote?.drawing ?? null}
                  authorName={authorName}
                  onAddComment={handleAddNoteOnCard}
                  onSelectComment={onSelectComment}
                />
              </div>
              {selectedNote && (
                <div className="shrink-0 w-72 border-l border-border bg-bg flex flex-col overflow-hidden">
                  <div className="shrink-0 px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-[11px] font-mono text-fg-muted">Note</span>
                    {selectedNote.completed && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-fg/15 text-fg-muted border border-border rounded">
                        <Check size={10} /> Done
                      </span>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {selectedNote.xPct != null && selectedNote.yPct != null && (
                      <p className="text-[11px] font-mono text-fg-muted flex items-center gap-1">
                        <MapPin size={10} /> Pinned on image
                      </p>
                    )}
                    {onSetPriority && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-fg-muted">Priority</span>
                        <div className="flex gap-1">
                          {(["high", "medium", "low"] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => onSetPriority(selectedNote.id, p)}
                              className={`px-2 py-1 text-[11px] font-mono border transition-colors ${(selectedNote.priority ?? "medium") === p ? "bg-fg text-bg border-fg" : "border-border text-fg-muted hover:text-fg"}`}
                            >
                              {p === "high" ? "High" : p === "medium" ? "Medium" : "Low"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className={`text-sm font-mono whitespace-pre-wrap break-words ${selectedNote.completed ? "line-through text-fg-muted" : "text-fg"}`}>
                      {selectedNote.text || "(No comment)"}
                    </p>
                    <p className="text-[11px] text-fg-muted">{selectedNote.authorName} · {formatCommentDate(selectedNote.createdAt)}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleCompleted(selectedNote.id, !selectedNote.completed)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono border border-border text-fg-muted hover:text-fg"
                      >
                        <Check size={10} /> {selectedNote.completed ? "Mark pending" : "Mark done"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteComment(selectedNote.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono border-2 border-red-600 text-red-600 bg-red-500/10 hover:bg-red-500/20"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
