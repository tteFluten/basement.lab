"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, PenTool, Trash2, MessageSquare, X, Send, Loader2 } from "lucide-react";
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
  onFpsDetected?: (fps: number) => void;
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
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

const DRAW_COLORS = ["#ef4444", "#f97316", "#facc15", "#4ade80", "#60a5fa", "#ffffff"];

export function VideoPlayer({ src, commentMarkers, seekTo, authorName, onAddComment, onFpsDetected }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPathRef = useRef<Point[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fpsRef = useRef<{ lastTime: number; samples: number[] }>({ lastTime: 0, samples: [] });
  const rvcIdRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentPaths, setCurrentPaths] = useState<DrawingPath[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  // Sync canvas size with video element
  useEffect(() => {
    const syncSize = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      redrawCanvas(currentPaths);
    };
    const observer = new ResizeObserver(syncSize);
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [currentPaths, redrawCanvas]);

  // FPS detection via requestVideoFrameCallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !("requestVideoFrameCallback" in video)) return;
    type RVFC = (now: number, meta: { mediaTime: number; presentedFrames: number }) => void;
    const onFrame: RVFC = (_now, meta) => {
      const dt = meta.mediaTime - fpsRef.current.lastTime;
      if (dt > 0 && dt < 0.1) {
        fpsRef.current.samples.push(1 / dt);
        if (fpsRef.current.samples.length > 20) fpsRef.current.samples.shift();
        if (fpsRef.current.samples.length >= 5) {
          const avg = fpsRef.current.samples.reduce((a, b) => a + b) / fpsRef.current.samples.length;
          // Round to common frame rates
          const common = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60];
          const rounded = common.reduce((best, r) => Math.abs(r - avg) < Math.abs(best - avg) ? r : best, avg);
          const display = Math.round(rounded === 23.976 ? 23.976 : rounded === 29.97 ? 29.97 : rounded);
          setFps((prev) => {
            const next = rounded;
            if (prev === null || Math.abs(next - prev) > 0.5) {
              onFpsDetected?.(display);
              return next;
            }
            return prev;
          });
        }
      }
      fpsRef.current.lastTime = meta.mediaTime;
      rvcIdRef.current = (video as unknown as { requestVideoFrameCallback: (cb: RVFC) => number }).requestVideoFrameCallback(onFrame);
    };
    rvcIdRef.current = (video as unknown as { requestVideoFrameCallback: (cb: RVFC) => number }).requestVideoFrameCallback(onFrame);
    return () => {
      (video as unknown as { cancelVideoFrameCallback: (id: number) => void }).cancelVideoFrameCallback(rvcIdRef.current);
    };
  }, [onFpsDetected]);

  // External seek
  useEffect(() => {
    if (seekTo == null || !videoRef.current) return;
    videoRef.current.currentTime = seekTo;
    setCurrentTime(seekTo);
  }, [seekTo]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying((v) => !v);
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const openPanel = useCallback((withDraw = false) => {
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    setShowPanel(true);
    if (withDraw) setIsDrawingMode(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [isPlaying]);

  const closePanel = useCallback(() => {
    setShowPanel(false);
    setIsDrawingMode(false);
    setCommentText("");
    setCurrentPaths([]);
    setSaveError(null);
    redrawCanvas([]);
  }, [redrawCanvas]);

  // Canvas drawing handlers
  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    setIsDrawing(true);
    currentPathRef.current = [getCanvasPoint(e)];
  }, [isDrawingMode]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pt = getCanvasPoint(e);
    currentPathRef.current.push(pt);
    const pts = currentPathRef.current;
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }, [isDrawing, isDrawingMode, drawColor]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPathRef.current.length > 0) {
      const newPath: DrawingPath = { points: [...currentPathRef.current], color: drawColor, width: 3 };
      setCurrentPaths((prev) => [...prev, newPath]);
      currentPathRef.current = [];
    }
  }, [isDrawing, drawColor]);

  const clearDrawing = useCallback(() => {
    setCurrentPaths([]);
    redrawCanvas([]);
  }, [redrawCanvas]);

  const handleSave = useCallback(async () => {
    if (!commentText.trim() && currentPaths.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onAddComment({
        timestampS: currentTime,
        text: commentText,
        drawing: currentPaths.length > 0 ? currentPaths : undefined,
        authorName,
      });
      closePanel();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [commentText, currentPaths, currentTime, authorName, onAddComment, closePanel]);

  const canSave = (commentText.trim().length > 0 || currentPaths.length > 0) && !saving;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto">
      {/* ── Video area ── */}
      <div className="relative bg-black aspect-video w-full overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            setDuration(video.duration);
            setVideoSize({ w: video.videoWidth, h: video.videoHeight });
            const canvas = canvasRef.current;
            if (canvas) { canvas.width = video.clientWidth; canvas.height = video.clientHeight; }
          }}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${isDrawingMode ? "cursor-crosshair" : "pointer-events-none"}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />

        {/* Drawing mode indicator */}
        {isDrawingMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/80 border border-white/20 px-3 py-1.5 text-xs font-mono text-white/80 pointer-events-none">
            Drawing mode — draw on the video then add your comment below
          </div>
        )}
      </div>

      {/* ── Video info strip ── */}
      {videoSize && (
        <div className="bg-[#0a0a0a] border-x border-border px-4 py-1.5 flex items-center gap-4 text-[11px] font-mono text-white/30">
          <span>{videoSize.w}×{videoSize.h}</span>
          {fps !== null && <span>{fps % 1 === 0 ? fps : fps.toFixed(3)} fps</span>}
          <span>{formatTime(duration)}</span>
        </div>
      )}

      {/* ── Control bar (always visible) ── */}
      <div className="bg-[#0a0a0a] border-x border-b border-border px-4 pt-3 pb-2">
        {/* Timeline */}
        <div className="relative h-5 flex items-center mb-2 group/tl">
          {/* comment markers */}
          {duration > 0 && commentMarkers.map((m) => (
            <div
              key={m.id}
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/40 group-hover/tl:bg-white/70 transition-colors pointer-events-none z-10"
              style={{ left: `${(m.timestampS / duration) * 100}%` }}
            />
          ))}
          {/* filled track */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 pointer-events-none">
            <div className="h-full bg-white/60 transition-none" style={{ width: `${progress}%` }} />
          </div>
          {/* scrubber thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full pointer-events-none z-20 -translate-x-1/2"
            style={{ left: `${progress}%` }}
          />
          <input
            type="range" min="0" max={duration || 100} step="0.1" value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="text-white/70 hover:text-white transition-colors"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-mono text-white/60 tabular-nums">
                {fps !== null ? formatSmpte(currentTime, Math.round(fps)) : formatTime(currentTime)}
              </span>
              {fps !== null && (
                <span className="text-[10px] font-mono text-white/25 tabular-nums">
                  f{Math.round(currentTime * fps)} / {formatTime(duration)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openPanel(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase transition-colors ${
                isDrawingMode && showPanel
                  ? "bg-red-500/20 border border-red-500/40 text-red-400"
                  : "border border-white/10 text-white/50 hover:text-white hover:border-white/30"
              }`}
            >
              <PenTool size={12} />
              Annotate
            </button>
            <button
              onClick={() => openPanel(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase transition-colors ${
                showPanel && !isDrawingMode
                  ? "bg-fg/10 border border-fg/30 text-fg"
                  : "border border-white/10 text-white/50 hover:text-white hover:border-white/30"
              }`}
            >
              <MessageSquare size={12} />
              Comment
            </button>
          </div>
        </div>
      </div>

      {/* ── Comment / annotation panel ── */}
      {showPanel && (
        <div className="border-x border-b border-border bg-bg">
          {/* Drawing toolbar */}
          {isDrawingMode && (
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-muted">
              <span className="text-xs font-mono text-fg-muted uppercase tracking-widest shrink-0">Color</span>
              <div className="flex gap-1.5">
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDrawColor(c)}
                    className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c, outline: drawColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                  />
                ))}
              </div>
              {currentPaths.length > 0 && (
                <button
                  onClick={clearDrawing}
                  className="ml-auto flex items-center gap-1.5 text-xs font-mono text-fg-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              )}
            </div>
          )}

          <div className="p-4">
            {/* Timestamp badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-mono text-fg-muted bg-bg-muted border border-border px-2 py-0.5">
                {fps !== null ? formatSmpte(currentTime, Math.round(fps)) : formatTime(currentTime)}
                {fps !== null && <span className="text-fg-muted/50 ml-1.5">f{Math.round(currentTime * fps)}</span>}
              </span>
              {isDrawingMode && currentPaths.length > 0 && (
                <span className="text-xs font-mono text-fg-muted bg-bg-muted border border-border px-2 py-0.5 flex items-center gap-1">
                  <PenTool size={10} />
                  {currentPaths.length} stroke{currentPaths.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave(); }}
              placeholder={isDrawingMode ? "Add a note about your drawing… (optional)" : "Type your feedback…"}
              className="w-full bg-bg-muted border border-border px-3 py-2.5 text-sm text-fg focus:outline-none focus:border-fg-muted min-h-[80px] resize-none font-mono placeholder:text-fg-muted/50"
            />

            {saveError && (
              <p className="text-xs font-mono text-red-400 mt-2">{saveError}</p>
            )}

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs font-mono text-fg-muted/60">⌘↵ to save</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={closePanel}
                  className="px-3 py-1.5 text-xs font-mono uppercase text-fg-muted hover:text-fg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono uppercase bg-fg text-bg hover:opacity-80 disabled:opacity-30 transition-opacity"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
