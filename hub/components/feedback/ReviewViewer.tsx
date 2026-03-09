"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  ExternalLink, Plus, PenTool, Trash2, Check, Loader2, ClipboardList, LayoutGrid, Upload, List, X, MapPin, Mic, ArrowUpDown,
} from "lucide-react";
import type { FeedbackComment, DrawingPath, Point, CommentPriority } from "@/lib/feedback/types";

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: Array<{ isFinal: boolean; [idx: number]: { transcript: string } | undefined }>;
}
interface SpeechRecognitionLike {
  start: () => void;
  stop: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onend: () => void;
  onerror: () => void;
}

const DRAW_COLORS = ["#ef4444", "#f97316", "#facc15", "#4ade80", "#60a5fa", "#ffffff"];

function formatCommentDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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

/** Draw paths on a 2d context (same logic as redrawCanvas). */
function drawPathsOnCtx(ctx: CanvasRenderingContext2D, paths: DrawingPath[]) {
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
}

/** Composite image (URL or Blob) with drawing paths into a single PNG blob. Dimensions must match the canvas where paths were drawn. */
async function compositeImageWithDrawing(
  imageSource: string | Blob,
  paths: DrawingPath[],
  width: number,
  height: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d not available");
  let img: HTMLImageElement | ImageBitmap;
  if (typeof imageSource === "string") {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image load failed"));
      el.src = imageSource;
    });
  } else {
    img = await createImageBitmap(imageSource);
  }
  ctx.drawImage(img, 0, 0, width, height);
  drawPathsOnCtx(ctx, paths);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
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
  onSetPriority,
}: ReviewViewerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"list" | "cards" | "checklist">("list");
  const [addingCard, setAddingCard] = useState(false);
  const [pasteImage, setPasteImage] = useState<string | null>(null);
  const [pasteBlob, setPasteBlob] = useState<Blob | null>(null);
  const [cardText, setCardText] = useState("");
  const [cardPaths, setCardPaths] = useState<DrawingPath[]>([]);
  const [pinPosition, setPinPosition] = useState<{ xPct: number; yPct: number } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [cardPriority, setCardPriority] = useState<CommentPriority>("medium");
  const [sortOrder, setSortOrder] = useState<"date-newest" | "date-oldest" | "priority-high" | "priority-low">("date-newest");
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [listPanelWidth, setListPanelWidth] = useState(360);
  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; w: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef<Point[]>([]);

  const sortedComments = [...comments].sort((a, b) => a.createdAt - b.createdAt);
  const [completedFilter, setCompletedFilter] = useState<"all" | "done" | "pending">("all");
  const filteredByCompleted = completedFilter === "all"
    ? sortedComments
    : completedFilter === "done"
      ? sortedComments.filter((c) => c.completed)
      : sortedComments.filter((c) => !c.completed);
  const priorityOrder = (p: CommentPriority | undefined | null) => (p === "high" ? 3 : p === "medium" ? 2 : 1);
  const filteredComments = [...filteredByCompleted].sort((a, b) => {
    if (sortOrder === "priority-high") {
      const d = priorityOrder(b.priority) - priorityOrder(a.priority);
      return d !== 0 ? d : b.createdAt - a.createdAt;
    }
    if (sortOrder === "priority-low") {
      const d = priorityOrder(a.priority) - priorityOrder(b.priority);
      return d !== 0 ? d : b.createdAt - a.createdAt;
    }
    if (sortOrder === "date-oldest") return a.createdAt - b.createdAt;
    return b.createdAt - a.createdAt; // date-newest
  });
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

  const MIN_LIST_WIDTH = 220;
  const MAX_LIST_WIDTH = 560;

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

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
    resizeStartRef.current = { x: e.clientX, w: listPanelWidth };
  }, [listPanelWidth]);

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

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
      setIsListening(false);
    };
  }, []);

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
    setPinPosition(null);
    setCardPriority("medium");
    fileInputRef.current?.click();
  }, []);

  const handleCancelAddCard = useCallback(() => {
    if (recognitionRef.current) {
      try { (recognitionRef.current as { stop?: () => void }).stop?.(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setAddingCard(false);
    if (pasteImage && pasteBlob) URL.revokeObjectURL(pasteImage);
    setPasteImage(null);
    setPasteBlob(null);
    setCardText("");
    setCardPaths([]);
    setPinPosition(null);
  }, [pasteImage, pasteBlob]);

  const supportsSpeechRecognition = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleVoiceInput = useCallback(() => {
    if (typeof window === "undefined") return;
    const Win = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SR = Win.SpeechRecognition ?? Win.webkitSpeechRecognition;
    if (!SR) return;
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || "en-US";
    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      let toAppend = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal && r[0]?.transcript) toAppend += r[0].transcript;
      }
      if (toAppend.trim()) setCardText((prev) => (prev ? `${prev} ${toAppend}` : toAppend).trim());
    };
    recognition.onend = () => { recognitionRef.current = null; setIsListening(false); };
    recognition.onerror = () => { recognitionRef.current = null; setIsListening(false); };
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  const handleSaveCard = useCallback(async () => {
    if (!pasteImage && !cardText.trim() && cardPaths.length === 0) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
      setIsListening(false);
    }
    setSaving(true);
    try {
      let screenshotUrl: string | null = null;
      const canvas = canvasRef.current;
      const hasImage = pasteBlob || (pasteImage && pasteImage.startsWith("http"));
      const hasDrawing = cardPaths.length > 0;

      if (hasImage && hasDrawing && canvas && canvas.width > 0 && canvas.height > 0) {
        const imageSource = pasteBlob ?? pasteImage!;
        const compositeBlob = await compositeImageWithDrawing(
          imageSource,
          cardPaths,
          canvas.width,
          canvas.height
        );
        screenshotUrl = await uploadImageForReview(compositeBlob, "screenshot-with-drawing.png");
      } else if (pasteBlob) {
        screenshotUrl = await uploadImageForReview(pasteBlob, "paste.png");
      } else if (pasteImage && pasteImage.startsWith("http")) {
        screenshotUrl = pasteImage;
      } else if (hasDrawing && canvas && canvas.width > 0 && canvas.height > 0) {
        const off = document.createElement("canvas");
        off.width = canvas.width;
        off.height = canvas.height;
        const ctx = off.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, off.width, off.height);
          drawPathsOnCtx(ctx, cardPaths);
          const blob = await new Promise<Blob | null>((resolve) => off.toBlob((b) => resolve(b), "image/png"));
          if (blob) screenshotUrl = await uploadImageForReview(blob, "drawing.png");
        }
      }

      const text = cardText.trim() || (screenshotUrl ? "Screenshot" : "") || " ";
      await onAddComment({
        timestampS: 0,
        text,
      authorName,
      screenshotUrl: screenshotUrl ?? undefined,
      xPct: pinPosition?.xPct ?? undefined,
      yPct: pinPosition?.yPct ?? undefined,
      priority: cardPriority,
    });
      if (pasteImage && pasteBlob) URL.revokeObjectURL(pasteImage);
      setAddingCard(false);
      setPasteImage(null);
      setPasteBlob(null);
      setCardText("");
      setCardPaths([]);
      setPinPosition(null);
    } finally {
      setSaving(false);
    }
  }, [pasteImage, pasteBlob, cardText, cardPaths, pinPosition, cardPriority, onAddComment, authorName]);

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

  const handleImageWrapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawing) return;
    const wrap = imageWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    if (xPct >= 0 && xPct <= 1 && yPct >= 0 && yPct <= 1) {
      setPinPosition({ xPct, yPct });
    }
  }, [isDrawing]);

  const handleExportLinear = useCallback(() => {
    const lines = [`# ${sessionTitle}`, "", `Reference: ${sourceUrl}`, ""];
    filteredComments.forEach((c, i) => {
      const check = viewMode === "checklist" && c.completed ? "[x]" : "[ ]";
      lines.push(`${check} ${i + 1}. ${c.text || "(screenshot)"}`);
      if (c.screenshotUrl) lines.push(`   Screenshot: ${c.screenshotUrl}`);
      lines.push("");
    });
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }, [sessionTitle, sourceUrl, filteredComments, viewMode]);

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
        <div className="flex items-center gap-0.5 border border-border">
          <button
            type="button"
            onClick={() => setCompletedFilter("all")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono ${completedFilter === "all" ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"}`}
            title="All items"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setCompletedFilter("done")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono ${completedFilter === "done" ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"}`}
            title="Done only"
          >
            <Check size={12} /> Done
          </button>
          <button
            type="button"
            onClick={() => setCompletedFilter("pending")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono ${completedFilter === "pending" ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"}`}
            title="To do only"
          >
            To do
          </button>
        </div>
        <div className="flex items-center gap-1.5 border border-border px-2 py-1">
          <ArrowUpDown size={12} className="text-fg-muted shrink-0" />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            className="bg-transparent text-xs font-mono text-fg focus:outline-none cursor-pointer"
            title="Sort order"
          >
            <option value="date-newest">Newest first</option>
            <option value="date-oldest">Oldest first</option>
            <option value="priority-high">Priority: high first</option>
            <option value="priority-low">Priority: low first</option>
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

      {/* Content: add card + list + detail panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div
          className={`overflow-y-auto space-y-4 shrink-0 border-r border-border p-4 ${selectedComment ? "" : "flex-1"}`}
          style={selectedComment ? { width: listPanelWidth } : undefined}
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
                <div
                  ref={imageWrapRef}
                  className="relative max-w-full bg-black/20 border border-border cursor-crosshair"
                  style={{ maxHeight: 280 }}
                  onClick={handleImageWrapClick}
                >
                  <img
                    src={pasteImage!}
                    alt="Paste"
                    className="max-h-[280px] w-full object-contain block pointer-events-none"
                    onLoad={resizeCanvasToImage}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full touch-none select-none z-10"
                    style={{ left: 0, top: 0, width: "100%", height: "100%", pointerEvents: isDrawing ? "auto" : "none", cursor: isDrawing ? "crosshair" : "inherit" }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseLeave}
                  />
                  {pinPosition && (
                    <div
                      style={{ left: `${pinPosition.xPct * 100}%`, top: `${pinPosition.yPct * 100}%` }}
                      className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 bg-fg text-bg flex items-center justify-center text-[10px] font-bold z-20 pointer-events-none shadow-md"
                    >
                      <MapPin size={12} />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-[11px] font-mono text-fg-muted">
                    {pinPosition ? "Pin placed · click image to move" : "Click image to place pin for note"}
                  </span>
                  {pinPosition && (
                    <button
                      type="button"
                      onClick={() => setPinPosition(null)}
                      className="text-[11px] font-mono text-fg-muted hover:text-fg"
                    >
                      Clear pin
                    </button>
                  )}
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
                <div className="flex gap-2 items-center justify-between">
                  <span className="text-[11px] font-mono text-fg-muted">Comment</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-fg-muted mr-1">Priority</span>
                    {(["high", "medium", "low"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCardPriority(p)}
                        className={`px-1.5 py-0.5 text-[10px] font-mono border transition-colors ${cardPriority === p ? "border-fg bg-fg text-bg" : "border-border text-fg-muted hover:text-fg"}`}
                        title={p === "high" ? "High" : p === "medium" ? "Medium" : "Low"}
                      >
                        {p === "high" ? "H" : p === "medium" ? "M" : "L"}
                      </button>
                    ))}
                  </div>
                  {supportsSpeechRecognition && (
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono border transition-colors ${isListening ? "border-red-500/60 bg-red-500/10 text-red-600" : "border-border text-fg-muted hover:text-fg hover:border-fg-muted"}`}
                      title={isListening ? "Stop recording" : "Record voice (speech to text)"}
                    >
                      <Mic size={12} className={isListening ? "animate-pulse" : ""} />
                      {isListening ? "Listening…" : "Voice"}
                    </button>
                  )}
                </div>
                <textarea
                  value={cardText}
                  onChange={(e) => setCardText(e.target.value)}
                  placeholder="Comment… (or use Voice to speak)"
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
          {filteredComments.map((c, index) => {
            const isSelected = selectedCommentId === c.id;
            const isCompleted = !!c.completed;
            if (viewMode === "list") {
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectComment(isSelected ? null : c.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectComment(isSelected ? null : c.id); } }}
                  className={`flex items-center gap-2 py-1.5 px-2 border-b border-border/50 cursor-pointer transition-colors hover:bg-bg-muted/80 ${isSelected ? "bg-bg-muted ring-inset ring-1 ring-fg/40" : ""} ${isCompleted ? "opacity-80" : ""}`}
                >
                  {isChecklistMode ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleCompleted(c.id, !c.completed); }}
                      className="shrink-0 w-3.5 h-3.5 flex items-center justify-center border border-border hover:border-fg-muted"
                    >
                      {isCompleted ? <Check size={8} className="text-fg" /> : null}
                    </button>
                  ) : isCompleted ? (
                    <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-fg-muted" title="Done">
                      <Check size={8} />
                    </span>
                  ) : (
                    <span className="shrink-0 w-3.5 h-3.5" aria-hidden />
                  )}
                  <span className="shrink-0 w-5 text-[10px] font-mono text-fg-muted tabular-nums">{index + 1}</span>
                  {c.screenshotUrl && (
                    <div className={`shrink-0 w-10 h-7 overflow-hidden border border-border/50 flex items-center bg-black/20 ${isCompleted ? "opacity-70" : ""}`}>
                      <img src={c.screenshotUrl} alt="" className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <span className={`flex-1 min-w-0 text-[11px] font-mono truncate ${isCompleted ? "line-through text-fg-muted" : "text-fg"}`}>{c.text || "(screenshot)"}</span>
                  <span className="shrink-0 text-[10px] font-mono text-fg-muted/80" title={new Date(c.createdAt).toLocaleString()}>{formatCommentDate(c.createdAt)}</span>
                  {onSetPriority && (
                    <div className="shrink-0 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {(["high", "medium", "low"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onSetPriority(c.id, p)}
                          title={p === "high" ? "High" : p === "medium" ? "Medium" : "Low"}
                          className={`w-4 h-4 flex items-center justify-center text-[9px] font-mono border transition-colors ${(c.priority ?? "medium") === p ? "bg-fg text-bg border-fg" : "border-border text-fg-muted hover:text-fg hover:border-fg-muted"}`}
                        >
                          {p === "high" ? "H" : p === "medium" ? "M" : "L"}
                        </button>
                      ))}
                    </div>
                  )}
                  {c.xPct != null && c.yPct != null && <span className="shrink-0" title="Has pin"><MapPin size={9} className="text-fg-muted" /></span>}
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
                className={`border border-border bg-bg-muted overflow-hidden transition-colors ${isSelected ? "ring-1 ring-fg/30" : ""} ${isCompleted ? "opacity-85" : ""}`}
              >
                <div className="flex items-center gap-2 p-2">
                  {isChecklistMode ? (
                    <button
                      type="button"
                      onClick={() => onToggleCompleted(c.id, !c.completed)}
                      className="shrink-0 w-4 h-4 flex items-center justify-center border border-border hover:border-fg-muted"
                    >
                      {isCompleted ? <Check size={10} className="text-fg" /> : null}
                    </button>
                  ) : isCompleted ? (
                    <span className="shrink-0 w-4 h-4 flex items-center justify-center text-fg-muted" title="Done">
                      <Check size={10} />
                    </span>
                  ) : (
                    <span className="shrink-0 w-4 h-4" aria-hidden />
                  )}
                  {c.screenshotUrl && (
                    <div
                      className={`shrink-0 w-16 h-12 overflow-hidden border border-border/50 cursor-pointer flex items-center bg-black/20 ${isCompleted ? "opacity-75" : ""}`}
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
                    {c.xPct != null && c.yPct != null && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-fg-muted">
                        <MapPin size={8} />
                      </span>
                    )}
                    <p className={`text-[12px] font-mono break-words line-clamp-2 ${isCompleted ? "line-through text-fg-muted" : "text-fg"}`}>{c.text || "(No comment)"}</p>
                    <p className="text-[10px] text-fg-muted truncate">{c.authorName} · {formatCommentDate(c.createdAt)}</p>
                    {onSetPriority && (
                      <div className="flex gap-0.5 mt-1" onClick={(e) => e.stopPropagation()}>
                        {(["high", "medium", "low"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => onSetPriority(c.id, p)}
                            title={p === "high" ? "High" : p === "medium" ? "Medium" : "Low"}
                            className={`w-5 h-5 flex items-center justify-center text-[9px] font-mono border transition-colors ${(c.priority ?? "medium") === p ? "bg-fg text-bg border-fg" : "border-border text-fg-muted hover:text-fg"}`}
                          >
                            {p === "high" ? "H" : p === "medium" ? "M" : "L"}
                          </button>
                        ))}
                      </div>
                    )}
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

        {/* Resize handle: only when detail is open */}
        {selectedComment && (
          <div
            role="separator"
            aria-label="Resize list width"
            onMouseDown={handleResizeStart}
            className={`shrink-0 w-1.5 flex items-stretch cursor-col-resize group transition-colors ${resizing ? "bg-fg/30" : "hover:bg-fg/20"}`}
          >
            <span className="w-1 bg-transparent group-hover:bg-fg/30 group-active:bg-fg/40 transition-colors" />
          </div>
        )}

        {/* Detail panel: selected item */}
        {selectedComment && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-l border-border bg-bg-muted/30">
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-fg-muted">Detail</span>
                {selectedComment.completed && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-fg/15 text-fg-muted border border-border rounded" title="Done">
                    <Check size={10} /> Done
                  </span>
                )}
              </div>
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
                <div className={`mb-4 border border-border overflow-hidden bg-black/20 relative ${selectedComment.completed ? "opacity-80" : ""}`}>
                  <img
                    src={selectedComment.screenshotUrl}
                    alt=""
                    className="w-full max-h-[70vh] object-contain object-top"
                  />
                  {selectedComment.xPct != null && selectedComment.yPct != null && (
                    <div
                      style={{ left: `${selectedComment.xPct * 100}%`, top: `${selectedComment.yPct * 100}%` }}
                      className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 bg-fg text-bg flex items-center justify-center rounded-full shadow-lg z-10"
                      title="Note pin"
                    >
                      <MapPin size={14} />
                    </div>
                  )}
                </div>
              )}
              {selectedComment.drawing && selectedComment.drawing.length > 0 && (
                <p className="text-[11px] font-mono text-fg-muted flex items-center gap-1 mb-2">
                  <PenTool size={10} /> Has annotation
                </p>
              )}
              {selectedComment.xPct != null && selectedComment.yPct != null && (
                <p className="text-[11px] font-mono text-fg-muted flex items-center gap-1 mb-2">
                  <MapPin size={10} /> Note pinned on image
                </p>
              )}
              {onSetPriority && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-mono text-fg-muted">Priority</span>
                  <div className="flex gap-1">
                    {(["high", "medium", "low"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onSetPriority(selectedComment.id, p)}
                        className={`px-2 py-1 text-[11px] font-mono border transition-colors ${(selectedComment.priority ?? "medium") === p ? "bg-fg text-bg border-fg" : "border-border text-fg-muted hover:text-fg"}`}
                      >
                        {p === "high" ? "High" : p === "medium" ? "Medium" : "Low"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className={`text-sm font-mono whitespace-pre-wrap break-words ${selectedComment.completed ? "line-through text-fg-muted" : "text-fg"}`}>{selectedComment.text || "(No comment)"}</p>
              <p className="text-[11px] text-fg-muted mt-2">{selectedComment.authorName} · {formatCommentDate(selectedComment.createdAt)}</p>
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
