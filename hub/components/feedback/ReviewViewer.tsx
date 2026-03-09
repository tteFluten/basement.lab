"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  ExternalLink, Plus, PenTool, Trash2, Check, Loader2, ClipboardList, LayoutGrid, Upload, List, X,
} from "lucide-react";
import type { FeedbackComment, DrawingPath, Point } from "@/lib/feedback/types";

const DRAW_COLORS = ["#ef4444", "#f97316", "#facc15", "#4ade80", "#60a5fa", "#ffffff"];

function screenToCanvas(e: React.MouseEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
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
    drawing?: DrawingPath[];
    authorName: string;
    screenshotUrl?: string | null;
  }) => Promise<void>;
  onSelectComment: (id: string | null) => void;
  onEditComment: (id: string, text: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  onToggleCompleted: (id: string, completed: boolean) => Promise<void>;
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

export function ReviewViewer({
  sourceUrl,
  sessionId,
  sessionTitle,
  comments,
  selectedCommentId,
  authorName,
  onAddComment,
  onSelectComment,
  onEditComment,
  onDeleteComment,
  onToggleCompleted,
}: ReviewViewerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"list" | "cards" | "checklist">("list");
  const [addingCard, setAddingCard] = useState(false);
  const [pasteImage, setPasteImage] = useState<string | null>(null);
  const [pasteBlob, setPasteBlob] = useState<Blob | null>(null);
  const [cardText, setCardText] = useState("");
  const [cardPaths, setCardPaths] = useState<DrawingPath[]>([]);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef<Point[]>([]);

  const sortedComments = [...comments].sort((a, b) => a.createdAt - b.createdAt);
  const selectedComment = selectedCommentId ? sortedComments.find((c) => c.id === selectedCommentId) : null;
  const isChecklistMode = viewMode === "checklist";
  const cardPathsRef = useRef<DrawingPath[]>([]);
  cardPathsRef.current = cardPaths;

  const redrawCanvas = useCallback((paths: DrawingPath[], canvas: HTMLCanvasElement | null) => {
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paths.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    });
  }, []);

  useEffect(() => {
    redrawCanvas(cardPaths, canvasRef.current);
  }, [cardPaths, redrawCanvas]);

  const resizeCanvasToImage = useCallback(() => {
    const wrap = imageWrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
      redrawCanvas(cardPaths, canvas);
    }
  }, [cardPaths, redrawCanvas]);

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
    setCardText("");
    setCardPaths([]);
    fileInputRef.current?.click();
  }, []);

  const handleCancelAddCard = useCallback(() => {
    setAddingCard(false);
    if (pasteImage && pasteBlob) URL.revokeObjectURL(pasteImage);
    setPasteImage(null);
    setPasteBlob(null);
    setCardText("");
    setCardPaths([]);
  }, []);

  const handleSaveCard = useCallback(async () => {
    if (!pasteImage && !cardText.trim() && cardPaths.length === 0) return;
    setSaving(true);
    try {
      let screenshotUrl: string | null = null;
      if (pasteBlob) {
        screenshotUrl = await uploadImageForReview(pasteBlob, "paste.png");
      } else if (pasteImage && pasteImage.startsWith("http")) {
        screenshotUrl = pasteImage;
      }
      const text = cardText.trim() || (screenshotUrl ? "Screenshot" : "") || " ";
      await onAddComment({
        timestampS: 0,
        text,
        drawing: cardPaths.length > 0 ? cardPaths : undefined,
        authorName,
        screenshotUrl: screenshotUrl ?? undefined,
      });
      if (pasteImage && pasteBlob) URL.revokeObjectURL(pasteImage);
      setAddingCard(false);
      setPasteImage(null);
      setPasteBlob(null);
      setCardText("");
      setCardPaths([]);
    } finally {
      setSaving(false);
    }
  }, [pasteImage, pasteBlob, cardText, cardPaths, onAddComment, authorName]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDrawing(true);
    const pt = screenToCanvas(e, canvas);
    currentPathRef.current = [pt];
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const pt = screenToCanvas(e, canvas);
    currentPathRef.current.push(pt);
    const ctx = canvas.getContext("2d");
    if (!ctx || currentPathRef.current.length < 2) return;
    const pts = currentPathRef.current;
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  const commitCurrentPath = useCallback(() => {
    const canvas = canvasRef.current;
    if (currentPathRef.current.length > 1 && canvas && canvas.width > 0) {
      const newPath: DrawingPath = { points: [...currentPathRef.current], color: drawColor, width: 3 };
      const nextPaths = [...cardPathsRef.current, newPath];
      setCardPaths(nextPaths);
      redrawCanvas(nextPaths, canvas);
    }
    currentPathRef.current = [];
  }, [drawColor, redrawCanvas]);

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    commitCurrentPath();
  };

  const handleCanvasMouseLeave = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      commitCurrentPath();
    }
  }, [isDrawing, commitCurrentPath]);

  const handleExportLinear = useCallback(() => {
    const lines = [`# ${sessionTitle}`, "", `Reference: ${sourceUrl}`, ""];
    sortedComments.forEach((c, i) => {
      const check = viewMode === "checklist" && c.completed ? "[x]" : "[ ]";
      lines.push(`${check} ${i + 1}. ${c.text || "(screenshot)"}`);
      if (c.screenshotUrl) lines.push(`   Screenshot: ${c.screenshotUrl}`);
      lines.push("");
    });
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }, [sessionTitle, sourceUrl, sortedComments, viewMode]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Top bar: link + URL + view toggle + export */}
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
            title="Checklist"
          >
            <ClipboardList size={12} /> Checklist
          </button>
        </div>
        <button
          type="button"
          onClick={handleExportLinear}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
        >
          Copy for Linear
        </button>
      </div>

      {/* Content: add card + list + detail panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className={`overflow-y-auto space-y-4 ${selectedComment ? "w-[320px] sm:w-[380px] shrink-0 border-r border-border" : "flex-1"} p-4`}>
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
                <div
                  ref={imageWrapRef}
                  className="relative max-w-full bg-black/20 border border-border"
                  style={{ maxHeight: 280 }}
                >
                  <img
                    src={pasteImage!}
                    alt="Paste"
                    className="max-h-[280px] w-full object-contain block"
                    onLoad={resizeCanvasToImage}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none select-none z-10"
                    style={{ left: 0, top: 0, width: "100%", height: "100%" }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseLeave}
                  />
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {DRAW_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDrawColor(c)}
                      className="w-5 h-5 border border-border"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <span className="text-[11px] text-fg-muted">Draw</span>
                </div>
                <textarea
                  value={cardText}
                  onChange={(e) => setCardText(e.target.value)}
                  placeholder="Comment…"
                  className="w-full bg-bg border border-border px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted resize-none min-h-[72px]"
                />
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

        <div className={viewMode === "list" ? "space-y-0.5" : "space-y-2"}>
          {sortedComments.map((c, index) => {
            const isSelected = selectedCommentId === c.id;
            if (viewMode === "list") {
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectComment(isSelected ? null : c.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectComment(isSelected ? null : c.id); } }}
                  className={`flex items-center gap-2 py-1.5 px-2 border-b border-border/50 cursor-pointer transition-colors hover:bg-bg-muted/80 ${isSelected ? "bg-bg-muted ring-inset ring-1 ring-fg/40" : ""} ${isChecklistMode && c.completed ? "opacity-60" : ""}`}
                >
                  {isChecklistMode && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleCompleted(c.id, !c.completed); }}
                      className="shrink-0 w-3.5 h-3.5 flex items-center justify-center border border-border hover:border-fg-muted"
                    >
                      {c.completed ? <Check size={8} className="text-fg" /> : null}
                    </button>
                  )}
                  <span className="shrink-0 w-5 text-[10px] font-mono text-fg-muted tabular-nums">{index + 1}</span>
                  {c.screenshotUrl && (
                    <div className="shrink-0 w-10 h-7 overflow-hidden border border-border/50 flex items-center bg-black/20">
                      <img src={c.screenshotUrl} alt="" className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <span className="flex-1 min-w-0 text-[11px] font-mono text-fg truncate">{c.text || "(screenshot)"}</span>
                  {c.drawing && c.drawing.length > 0 && <PenTool size={9} className="shrink-0 text-fg-muted" />}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDeleteComment(c.id); }}
                    className="p-0.5 text-red-600 hover:text-red-500 hover:bg-red-500/15 border border-red-600/40 shrink-0 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              );
            }
            return (
              <div
                key={c.id}
                className={`border border-border bg-bg-muted overflow-hidden transition-colors ${isSelected ? "ring-1 ring-fg/30" : ""} ${isChecklistMode && c.completed ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-2 p-2">
                  {isChecklistMode && (
                    <button
                      type="button"
                      onClick={() => onToggleCompleted(c.id, !c.completed)}
                      className="shrink-0 w-4 h-4 flex items-center justify-center border border-border hover:border-fg-muted"
                    >
                      {c.completed ? <Check size={10} className="text-fg" /> : null}
                    </button>
                  )}
                  {c.screenshotUrl && (
                    <div
                      className="shrink-0 w-16 h-12 overflow-hidden border border-border/50 cursor-pointer flex items-center bg-black/20"
                      onClick={() => onSelectComment(isSelected ? null : c.id)}
                    >
                      <img src={c.screenshotUrl} alt="" className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <div
                    className="flex-1 min-w-0 cursor-pointer py-0.5"
                    onClick={() => onSelectComment(isSelected ? null : c.id)}
                  >
                    {c.drawing && c.drawing.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-fg-muted">
                        <PenTool size={8} />
                      </span>
                    )}
                    <p className="text-[12px] font-mono text-fg break-words line-clamp-2">{c.text || "(No comment)"}</p>
                    <p className="text-[10px] text-fg-muted truncate">{c.authorName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDeleteComment(c.id); }}
                    className="p-1 text-red-600 hover:text-red-500 hover:bg-red-500/15 border border-red-600/40 shrink-0 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* Detail panel: selected item */}
        {selectedComment && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-l border-border bg-bg-muted/30">
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-[11px] font-mono text-fg-muted">Detail</span>
              <button
                type="button"
                onClick={() => onSelectComment(null)}
                className="p-1 text-fg-muted hover:text-fg"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedComment.screenshotUrl && (
                <div className="mb-4 border border-border overflow-hidden bg-black/20">
                  <img
                    src={selectedComment.screenshotUrl}
                    alt=""
                    className="w-full max-h-[70vh] object-contain object-top"
                  />
                </div>
              )}
              {selectedComment.drawing && selectedComment.drawing.length > 0 && (
                <p className="text-[11px] font-mono text-fg-muted flex items-center gap-1 mb-2">
                  <PenTool size={10} /> Has annotation
                </p>
              )}
              <p className="text-sm font-mono text-fg whitespace-pre-wrap break-words">{selectedComment.text || "(No comment)"}</p>
              <p className="text-[11px] text-fg-muted mt-2">{selectedComment.authorName}</p>
              <button
                type="button"
                onClick={() => onDeleteComment(selectedComment.id)}
                className="mt-4 flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono border-2 border-red-600 text-red-600 bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={10} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
