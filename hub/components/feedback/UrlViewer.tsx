"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  GripVertical, MessageSquare, X, Loader2, ExternalLink,
  Camera, PenTool, Trash2,
} from "lucide-react";
import type { FeedbackComment, DrawingPath, Point } from "@/lib/feedback/types";

const DRAW_COLORS = ["#ef4444", "#f97316", "#facc15", "#4ade80", "#60a5fa", "#ffffff"];

function screenToCanvas(e: MouseEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

interface UrlViewerProps {
  url: string;
  sessionId: string;
  comments: FeedbackComment[];
  selectedCommentId?: string | null;
  authorName: string;
  onAddComment: (data: {
    timestampS: number;
    text: string;
    drawing?: DrawingPath[];
    authorName: string;
    screenshotUrl?: string | null;
  }) => Promise<void>;
  onSelectComment: (id: string | null) => void;
}

async function captureScreenshot(url: string): Promise<string | null> {
  try {
    const res = await fetch("/api/feedback/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    return (await res.json()).screenshotUrl ?? null;
  } catch { return null; }
}

export function UrlViewer({
  url, comments, selectedCommentId, authorName, onAddComment, onSelectComment,
}: UrlViewerProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mx: number; my: number; bx: number; by: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPathRef = useRef<Point[]>([]);

  const [pos, setPos] = useState({ x: 24, y: 72 });
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentPaths, setCurrentPaths] = useState<DrawingPath[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);

  // Drawing canvas logic
  const redrawCanvas = useCallback((paths: DrawingPath[]) => {
    const canvas = canvasRef.current;
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

  useEffect(() => { redrawCanvas(currentPaths); }, [currentPaths, redrawCanvas]);

  const handleCanvasMouseDown = useCallback((e: MouseEvent) => {
    if (!isDrawingMode || !canvasRef.current) return;
    setIsDrawing(true);
    const pt = screenToCanvas(e, canvasRef.current);
    currentPathRef.current = [pt];
  }, [isDrawingMode]);

  const handleCanvasMouseMove = useCallback((e: MouseEvent) => {
    if (!isDrawing || !isDrawingMode || !canvasRef.current) return;
    const pt = screenToCanvas(e, canvasRef.current);
    currentPathRef.current.push(pt);
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx || currentPathRef.current.length < 2) return;
    const pts = currentPathRef.current;
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }, [isDrawing, isDrawingMode, drawColor]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!isDrawing || !isDrawingMode) return;
    setIsDrawing(false);
    if (currentPathRef.current.length > 1) {
      const newPath: DrawingPath = { points: [...currentPathRef.current], color: drawColor, width: 3 };
      setCurrentPaths((prev) => [...prev, newPath]);
    }
    currentPathRef.current = [];
  }, [isDrawing, isDrawingMode, drawColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawingMode) return;
    canvas.addEventListener("mousedown", handleCanvasMouseDown);
    canvas.addEventListener("mousemove", handleCanvasMouseMove);
    canvas.addEventListener("mouseup", handleCanvasMouseUp);
    canvas.addEventListener("mouseleave", handleCanvasMouseUp);
    return () => {
      canvas.removeEventListener("mousedown", handleCanvasMouseDown);
      canvas.removeEventListener("mousemove", handleCanvasMouseMove);
      canvas.removeEventListener("mouseup", handleCanvasMouseUp);
      canvas.removeEventListener("mouseleave", handleCanvasMouseUp);
    };
  }, [isDrawingMode, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp]);

  // Drag logic
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: dragRef.current.bx + e.clientX - dragRef.current.mx,
      y: dragRef.current.by + e.clientY - dragRef.current.my,
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { mx: e.clientX, my: e.clientY, bx: pos.x, by: pos.y };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  useEffect(() => () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove, onMouseUp]);

  function closeForm() {
    setExpanded(false);
    setCommentText("");
    setIsDrawingMode(false);
    setCurrentPaths([]);
    redrawCanvas([]);
    currentPathRef.current = [];
  }

  async function handleSave() {
    if (!commentText.trim() && currentPaths.length === 0) return;
    setSaving(true);
    setCapturingScreenshot(true);
    let screenshotUrl: string | null = null;
    try {
      screenshotUrl = await captureScreenshot(url);
    } finally {
      setCapturingScreenshot(false);
    }
    try {
      await onAddComment({
        timestampS: 0,
        text: commentText.trim(),
        drawing: currentPaths.length > 0 ? currentPaths : undefined,
        authorName,
        screenshotUrl,
      });
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  // Clamp position to viewport on mount
  useEffect(() => {
    const clamp = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPos((p) => ({
        x: Math.max(0, Math.min(p.x, vw - 280)),
        y: Math.max(0, Math.min(p.y, vh - 60)),
      }));
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  const displayUrl = (() => {
    try { return new URL(url).hostname; }
    catch { return url; }
  })();

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* iframe */}
      {iframeError ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0d0d0d] text-fg-muted">
          <ExternalLink size={40} strokeWidth={1} className="opacity-40" />
          <p className="text-sm font-mono">This site can't be shown in an iframe.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg transition-colors"
          >
            <ExternalLink size={12} /> Open in new tab
          </a>
          <p className="text-[11px] text-fg-muted/50 font-mono max-w-sm text-center">
            You can still add notes below — a screenshot will be captured server-side.
          </p>
        </div>
      ) : (
        <iframe
          src={url}
          className="w-full h-full border-0"
          title="URL preview"
          onError={() => setIframeError(true)}
        />
      )}

      {/* Drawing canvas overlay — covers iframe when drawing mode is active */}
      {expanded && isDrawingMode && (
        <canvas
          ref={canvasRef}
          width={typeof window !== "undefined" ? window.innerWidth : 1920}
          height={typeof window !== "undefined" ? window.innerHeight : 1080}
          className="absolute inset-0 w-full h-full z-[9998]"
          style={{ cursor: "crosshair" }}
        />
      )}

      {/* Floating draggable toolbar */}
      <div
        ref={toolbarRef}
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, width: 272 }}
        className="bg-bg border border-border shadow-2xl"
      >
        {/* Header — drag handle */}
        <div
          onMouseDown={startDrag}
          className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-muted cursor-grab active:cursor-grabbing select-none"
        >
          <GripVertical size={14} className="text-fg-muted/50 shrink-0" />
          <span className="text-[11px] font-mono text-fg-muted truncate flex-1">{displayUrl}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-0.5 text-fg-muted/50 hover:text-fg transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            title="Open in new tab"
          >
            <ExternalLink size={11} />
          </a>
        </div>

        {/* Comment input area */}
        {expanded ? (
          <div className="p-3 space-y-2">
            {/* Drawing controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsDrawingMode((v) => !v)}
                className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono uppercase border transition-colors ${
                  isDrawingMode ? "border-fg bg-fg text-bg" : "border-border text-fg-muted hover:text-fg"
                }`}
              >
                <PenTool size={10} />
                {isDrawingMode ? "Drawing" : "Draw"}
              </button>
              {isDrawingMode && (
                <>
                  <div className="flex items-center gap-1">
                    {DRAW_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setDrawColor(c)}
                        className={`w-4 h-4 transition-transform ${drawColor === c ? "scale-125 ring-1 ring-white/50" : "hover:scale-110"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => { setCurrentPaths([]); redrawCanvas([]); }}
                    className="flex items-center gap-0.5 px-1.5 py-1 text-[11px] font-mono text-fg-muted hover:text-red-400 border border-border transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </>
              )}
            </div>
            <textarea
              autoFocus={!isDrawingMode}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave(); }}
              placeholder="Your feedback… (Cmd+Enter to save)"
              rows={3}
              className="w-full bg-bg-muted border border-border px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted resize-none placeholder:text-fg-muted/50"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving || (!commentText.trim() && currentPaths.length === 0)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase bg-fg text-bg hover:opacity-80 disabled:opacity-40 transition-opacity flex-1 justify-center"
              >
                {saving ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    {capturingScreenshot ? "Capturing…" : "Saving…"}
                  </>
                ) : (
                  <>
                    <Camera size={11} />
                    Save + Screenshot
                  </>
                )}
              </button>
              <button
                onClick={closeForm}
                className="p-1.5 text-fg-muted hover:text-fg border border-border transition-colors"
              >
                <X size={13} />
              </button>
            </div>
            <p className="text-[10px] font-mono text-fg-muted/40">
              {isDrawingMode ? "Draw on the page, then save." : "Screenshot is captured automatically on save."}
            </p>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-fg-muted hover:text-fg hover:bg-bg-muted transition-colors"
          >
            <MessageSquare size={13} />
            Add feedback note
            <span className="ml-auto text-fg-muted/40 bg-bg border border-border px-1.5 py-0.5 text-[10px] font-mono">{comments.length}</span>
          </button>
        )}

        {/* Recent comments peek */}
        {comments.length > 0 && !expanded && (
          <div className="border-t border-border">
            <div className="max-h-40 overflow-y-auto divide-y divide-border">
              {[...comments].reverse().slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelectComment(selectedCommentId === c.id ? null : c.id)}
                  className={`px-3 py-2.5 cursor-pointer transition-colors ${
                    selectedCommentId === c.id ? "bg-bg-muted" : "hover:bg-bg-muted/50"
                  }`}
                >
                  {c.screenshotUrl && (
                    <img
                      src={c.screenshotUrl}
                      alt=""
                      className="w-full h-14 object-cover object-top mb-1.5 border border-border/50"
                    />
                  )}
                  <p className="text-[12px] font-mono text-fg leading-relaxed line-clamp-2">{c.text}</p>
                  <p className="text-[10px] font-mono text-fg-muted/50 mt-1">{c.authorName}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
