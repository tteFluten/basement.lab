"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, PenTool, Trash2, MessageSquare } from "lucide-react";
import type { DrawingPath, Point } from "@/lib/feedback/types";

interface VideoPlayerProps {
  src: string;
  commentMarkers: { id: string; timestampS: number }[];
  seekTo?: number | null;
  authorName: string;
  onAddComment: (data: {
    timestampS: number;
    text: string;
    drawing?: DrawingPath[];
    authorName: string;
  }) => Promise<void>;
}

function formatTime(s: number) {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoPlayer({ src, commentMarkers, seekTo, authorName, onAddComment }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPathRef = useRef<Point[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentPaths, setCurrentPaths] = useState<DrawingPath[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);

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

  // Sync canvas size with video
  useEffect(() => {
    const update = () => {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.clientWidth;
        canvasRef.current.height = videoRef.current.clientHeight;
        redrawCanvas(currentPaths);
      }
    };
    window.addEventListener("resize", update);
    videoRef.current?.addEventListener("loadedmetadata", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, [currentPaths, redrawCanvas]);

  // External seek
  useEffect(() => {
    if (seekTo == null || !videoRef.current) return;
    videoRef.current.currentTime = seekTo;
    setCurrentTime(seekTo);
    setCurrentPaths([]);
    redrawCanvas([]);
  }, [seekTo, redrawCanvas]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setIsDrawing(true);
    currentPathRef.current = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPathRef.current.push({ x, y });
    const pts = currentPathRef.current;
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPathRef.current.length > 0) {
      const newPath: DrawingPath = { points: [...currentPathRef.current], color: "#ef4444", width: 3 };
      const newPaths = [...currentPaths, newPath];
      setCurrentPaths(newPaths);
      currentPathRef.current = [];
    }
  };

  const clearDrawing = () => {
    setCurrentPaths([]);
    redrawCanvas([]);
  };

  const handleSaveComment = async () => {
    if (!commentText.trim() && currentPaths.length === 0) return;
    setSaving(true);
    try {
      await onAddComment({
        timestampS: currentTime,
        text: commentText,
        drawing: currentPaths.length > 0 ? currentPaths : undefined,
        authorName,
      });
      setCommentText("");
      setShowCommentInput(false);
      setIsDrawingMode(false);
      setCurrentPaths([]);
      redrawCanvas([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto border border-border bg-bg-muted">
      {/* Video */}
      <div className="relative bg-black aspect-video w-full overflow-hidden group">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setIsPlaying(false)}
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${isDrawingMode ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />

        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-4 mb-2">
            <button onClick={togglePlay} className="text-white hover:text-fg-muted transition-colors">
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            <div className="relative flex-1 h-3 flex items-center group/timeline">
              {duration > 0 &&
                commentMarkers.map((m) => (
                  <div
                    key={m.id}
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-fg-muted pointer-events-none z-10 opacity-50 group-hover/timeline:opacity-100 transition-opacity"
                    style={{ left: `${(m.timestampS / duration) * 100}%` }}
                  />
                ))}
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div className="w-full h-0.5 bg-border pointer-events-none">
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>
            </div>

            <span className="text-xs font-mono text-fg-muted tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const entering = !isDrawingMode;
                  setIsDrawingMode(entering);
                  if (entering) {
                    if (videoRef.current) { videoRef.current.pause(); setIsPlaying(false); }
                    setShowCommentInput(true);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase transition-colors ${
                  isDrawingMode ? "bg-fg text-bg" : "bg-bg border border-border text-fg-muted hover:text-fg"
                }`}
              >
                <PenTool size={14} />
                {isDrawingMode ? "Drawing" : "Annotate"}
              </button>
              {isDrawingMode && (
                <button onClick={clearDrawing} className="p-1.5 text-fg-muted hover:text-red-400 transition-colors" title="Clear">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {!isDrawingMode && !showCommentInput && (
              <button
                onClick={() => {
                  setShowCommentInput(true);
                  if (videoRef.current) { videoRef.current.pause(); setIsPlaying(false); }
                }}
                className="flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase bg-bg border border-border text-fg-muted hover:text-fg transition-colors"
              >
                <MessageSquare size={14} />
                Comment
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comment input */}
      {showCommentInput && (
        <div className="p-4 border-t border-border bg-bg">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Type your feedback here..."
            className="w-full bg-bg-muted border border-border p-3 text-sm text-fg focus:outline-none focus:border-fg-muted min-h-[80px] resize-none font-mono"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setShowCommentInput(false); setIsDrawingMode(false); setCommentText(""); clearDrawing(); }}
              className="px-4 py-2 text-xs font-mono uppercase text-fg-muted hover:text-fg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveComment}
              disabled={saving || (!commentText.trim() && currentPaths.length === 0)}
              className="px-4 py-2 text-xs font-mono uppercase bg-fg text-bg hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {saving ? "Saving…" : "Save feedback"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
