"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { PenTool, Trash2, Send, X, Loader2, ZoomIn } from "lucide-react";
import type { DrawingPath, Point, FeedbackComment } from "@/lib/feedback/types";

const DRAW_COLORS = ["#ef4444", "#f97316", "#facc15", "#4ade80", "#60a5fa", "#ffffff"];

interface ImageAnnotatorProps {
  src: string;
  comments: FeedbackComment[];
  selectedCommentId?: string | null;
  overlayDrawing?: DrawingPath[] | null;
  authorName: string;
  onAddComment: (data: {
    timestampS: number;
    text: string;
    drawing?: DrawingPath[];
    authorName: string;
    xPct: number;
    yPct: number;
  }) => Promise<void>;
  onSelectComment: (id: string | null) => void;
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

export function ImageAnnotator({
  src, comments, selectedCommentId, overlayDrawing, authorName, onAddComment, onSelectComment,
}: ImageAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPathRef = useRef<Point[]>([]);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [pendingPin, setPendingPin] = useState<{ xPct: number; yPct: number } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentPaths, setCurrentPaths] = useState<DrawingPath[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);

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

  // Redraw when paths change
  useEffect(() => { redrawCanvas(currentPaths); }, [currentPaths, redrawCanvas]);

  // Show overlay drawing when a saved comment is selected (no pending pin)
  useEffect(() => {
    if (!pendingPin && overlayDrawing) {
      redrawCanvas(overlayDrawing);
    } else if (!pendingPin && !overlayDrawing) {
      redrawCanvas([]);
    }
  }, [overlayDrawing, pendingPin, redrawCanvas]);

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isDrawingMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    setPendingPin({ xPct, yPct });
    setCommentText("");
    setCurrentPaths([]);
    redrawCanvas([]);
    onSelectComment(null);
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingMode || !canvasRef.current) return;
    e.stopPropagation();
    setIsDrawing(true);
    const pt = screenToCanvas(e, canvasRef.current);
    currentPathRef.current = [pt];
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !isDrawingMode || !canvasRef.current) return;
    e.stopPropagation();
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
  }

  function handleCanvasMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !isDrawingMode) return;
    e.stopPropagation();
    setIsDrawing(false);
    if (currentPathRef.current.length > 1) {
      const newPath: DrawingPath = {
        points: [...currentPathRef.current],
        color: drawColor,
        width: 3,
      };
      setCurrentPaths((prev) => {
        const updated = [...prev, newPath];
        return updated;
      });
    }
    currentPathRef.current = [];
  }

  async function handleSaveComment() {
    if (!pendingPin) return;
    if (!commentText.trim() && currentPaths.length === 0) return;
    setSaving(true);
    try {
      await onAddComment({
        timestampS: 0,
        text: commentText.trim(),
        drawing: currentPaths.length > 0 ? currentPaths : undefined,
        authorName,
        xPct: pendingPin.xPct,
        yPct: pendingPin.yPct,
      });
      setPendingPin(null);
      setCommentText("");
      setCurrentPaths([]);
      redrawCanvas([]);
      setIsDrawingMode(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelPin() {
    setPendingPin(null);
    setCommentText("");
    setCurrentPaths([]);
    redrawCanvas([]);
    setIsDrawingMode(false);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d0d]">
      {/* Image + annotation canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <div
          ref={containerRef}
          className="relative"
          style={imgSize ? {
            aspectRatio: `${imgSize.w}/${imgSize.h}`,
            maxWidth: "100%",
            maxHeight: "calc(100vh - 200px)",
            cursor: isDrawingMode ? "crosshair" : "crosshair",
          } : { width: "100%", height: "100%" }}
          onClick={handleContainerClick}
        >
          <img
            src={src}
            alt=""
            className="block w-full h-full object-contain"
            onLoad={(e) => {
              const img = e.currentTarget;
              const { naturalWidth: w, naturalHeight: h } = img;
              setImgSize({ w, h });
              if (canvasRef.current) {
                canvasRef.current.width = w;
                canvasRef.current.height = h;
              }
            }}
            draggable={false}
          />

          {/* Drawing canvas */}
          <canvas
            ref={canvasRef}
            width={imgSize?.w ?? 1920}
            height={imgSize?.h ?? 1080}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: isDrawingMode ? "auto" : "none" }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />

          {/* Existing pins */}
          {comments.map((c, i) => {
            if (c.xPct == null || c.yPct == null) return null;
            const isSelected = selectedCommentId === c.id;
            return (
              <button
                key={c.id}
                onClick={(e) => { e.stopPropagation(); onSelectComment(isSelected ? null : c.id); }}
                style={{ left: `${c.xPct * 100}%`, top: `${c.yPct * 100}%` }}
                className={`absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[11px] font-bold transition-all z-10 select-none ${
                  isSelected
                    ? "w-7 h-7 bg-fg text-bg shadow-[0_0_0_3px_rgba(255,255,255,0.3)]"
                    : "bg-fg/90 text-bg hover:bg-fg hover:scale-110 shadow-md"
                }`}
                title={c.text || `Annotation ${i + 1}`}
              >
                {i + 1}
              </button>
            );
          })}

          {/* Pending pin */}
          {pendingPin && (
            <div
              style={{ left: `${pendingPin.xPct * 100}%`, top: `${pendingPin.yPct * 100}%` }}
              className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 bg-blue-500 border-2 border-white/60 flex items-center justify-center text-white text-[11px] font-bold pointer-events-none z-10 shadow-md"
            >
              +
            </div>
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="shrink-0 border-t border-border bg-bg">
        {pendingPin ? (
          /* Comment form */
          <div className="flex flex-col gap-2 p-3">
            {/* Drawing tools */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsDrawingMode((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase border transition-colors ${
                  isDrawingMode ? "border-fg bg-fg text-bg" : "border-border text-fg-muted hover:text-fg"
                }`}
              >
                <PenTool size={11} />
                {isDrawingMode ? "Drawing" : "Draw"}
              </button>
              {isDrawingMode && (
                <>
                  <div className="flex items-center gap-1">
                    {DRAW_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setDrawColor(c)}
                        className={`w-5 h-5 transition-transform ${drawColor === c ? "scale-125 ring-1 ring-white/50" : "hover:scale-110"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => { setCurrentPaths([]); redrawCanvas([]); }}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-mono text-fg-muted hover:text-red-400 border border-border transition-colors"
                  >
                    <Trash2 size={11} /> Clear
                  </button>
                </>
              )}
              <span className="text-[10px] text-fg-muted/50 font-mono ml-auto">Click image to move pin</span>
            </div>
            {/* Text + actions */}
            <div className="flex gap-2 items-end">
              <textarea
                autoFocus
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveComment(); }}
                placeholder="Add a note… (Cmd+Enter to save)"
                rows={2}
                className="flex-1 bg-bg-muted border border-border px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted resize-none placeholder:text-fg-muted/50"
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={handleSaveComment}
                  disabled={saving || (!commentText.trim() && currentPaths.length === 0)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase bg-fg text-bg hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Save
                </button>
                <button
                  onClick={handleCancelPin}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg transition-colors"
                >
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-mono text-fg-muted/50">
            <ZoomIn size={11} />
            Click anywhere on the image to add a pin annotation
          </div>
        )}
      </div>
    </div>
  );
}
