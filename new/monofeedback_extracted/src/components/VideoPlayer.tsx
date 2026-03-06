import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, PenTool, Trash2, MessageSquare, X } from 'lucide-react';
import { Comment, DrawingPath, Point } from '../types';

interface VideoPlayerProps {
  src: string;
  comments: Comment[];
  onAddComment: (comment: Omit<Comment, 'id' | 'createdAt'>) => void;
  seekTo?: number | null;
}

export function VideoPlayer({ src, comments, onAddComment, seekTo }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentPaths, setCurrentPaths] = useState<DrawingPath[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  
  // Drawing state
  const currentPathRef = useRef<Point[]>([]);

  // Initialize canvas size
  useEffect(() => {
    const updateCanvasSize = () => {
      if (videoRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = videoRef.current;
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
        
        // Redraw if needed (e.g. window resize)
        redrawCanvas(currentPaths);
      }
    };

    window.addEventListener('resize', updateCanvasSize);
    // Also update when video metadata loads
    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadedmetadata', updateCanvasSize);
    }
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (video) {
        video.removeEventListener('loadedmetadata', updateCanvasSize);
      }
    };
  }, [currentPaths]);

  // Handle video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
        // Clear drawing when playing starts
        if (!isDrawingMode) {
            setCurrentPaths([]);
            redrawCanvas([]);
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      
      // Check if there's a comment at this time (roughly) and draw it
      const nearbyComment = comments.find(c => Math.abs(c.timestamp - time) < 0.5);
      if (nearbyComment && nearbyComment.drawing) {
        setCurrentPaths(nearbyComment.drawing);
        redrawCanvas(nearbyComment.drawing);
      } else {
        setCurrentPaths([]);
        redrawCanvas([]);
      }
    }
  };

  // Drawing Logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    currentPathRef.current = [{ x, y }];
    
    // Pause video when drawing starts
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentPathRef.current.push({ x, y });

    // Draw immediate line
    const points = currentPathRef.current;
    if (points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#ef4444'; // Red-500
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentPathRef.current.length > 0) {
      const newPath: DrawingPath = {
        points: [...currentPathRef.current],
        color: '#ef4444',
        width: 3
      };
      const newPaths = [...currentPaths, newPath];
      setCurrentPaths(newPaths);
      currentPathRef.current = [];
    }
  };

  const redrawCanvas = (paths: DrawingPath[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    paths.forEach(path => {
      if (path.points.length < 2) return;
      
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  };

  const clearDrawing = () => {
    setCurrentPaths([]);
    redrawCanvas([]);
  };

  // Handle external seek
  useEffect(() => {
    if (seekTo !== null && seekTo !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
      
      // Check for drawing at this time
      const nearbyComment = comments.find(c => Math.abs(c.timestamp - seekTo) < 0.5);
      if (nearbyComment && nearbyComment.drawing) {
        setCurrentPaths(nearbyComment.drawing);
        redrawCanvas(nearbyComment.drawing);
      } else {
        setCurrentPaths([]);
        redrawCanvas([]);
      }
    }
  }, [seekTo, comments]);

  const handleSaveComment = () => {
    if (!commentText.trim() && currentPaths.length === 0) return;
    
    onAddComment({
      timestamp: currentTime,
      text: commentText,
      author: 'User', // Placeholder
      drawing: currentPaths.length > 0 ? currentPaths : undefined
    });

    setCommentText('');
    setShowCommentInput(false);
    setIsDrawingMode(false);
    setCurrentPaths([]);
    redrawCanvas([]);
    
    // Resume play? Maybe not, let user decide.
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto border border-zinc-800 bg-zinc-900/50">
      {/* Video Container */}
      <div ref={containerRef} className="relative bg-black aspect-video w-full overflow-hidden group">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setIsPlaying(false)}
        />
        
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${isDrawingMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />

        {/* Overlay Controls (visible on hover or paused) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-4 mb-2">
            <button onClick={togglePlay} className="text-white hover:text-zinc-300">
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            
            <div className="relative flex-1 h-3 flex items-center group/timeline">
              {/* Markers */}
              {duration > 0 && comments.map((comment) => (
                <div
                  key={comment.id}
                  className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-zinc-500 pointer-events-none z-10 opacity-50 group-hover/timeline:opacity-100 transition-opacity"
                  style={{ left: `${(comment.timestamp / duration) * 100}%` }}
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
              
              {/* Custom Track */}
              <div className="w-full h-0.5 bg-zinc-800 pointer-events-none">
                <div 
                  className="h-full bg-white transition-all duration-75 ease-linear"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>
            </div>
            
            <span className="text-xs font-mono text-zinc-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsDrawingMode(!isDrawingMode);
                  if (!isDrawingMode) {
                    // Pause when entering drawing mode
                    if (videoRef.current) {
                        videoRef.current.pause();
                        setIsPlaying(false);
                    }
                    setShowCommentInput(true);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase transition-colors ${
                  isDrawingMode ? 'bg-zinc-100 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <PenTool size={14} />
                {isDrawingMode ? 'Drawing Active' : 'Annotate'}
              </button>

              {isDrawingMode && (
                <button
                  onClick={clearDrawing}
                  className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Clear Drawing"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {!isDrawingMode && !showCommentInput && (
               <button
               onClick={() => {
                 setShowCommentInput(true);
                 if (videoRef.current) {
                    videoRef.current.pause();
                    setIsPlaying(false);
                 }
               }}
               className="flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
             >
               <MessageSquare size={14} />
               Comment
             </button>
            )}
          </div>
        </div>
      </div>

      {/* Comment Input Area */}
      {showCommentInput && (
        <div className="p-4 border-t border-zinc-800 bg-zinc-900">
          <div className="flex gap-4">
            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Type your feedback here..."
                className="w-full bg-black border border-zinc-800 p-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 min-h-[80px] resize-none font-mono"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    setShowCommentInput(false);
                    setIsDrawingMode(false);
                    setCommentText('');
                    clearDrawing();
                  }}
                  className="px-4 py-2 text-xs font-mono uppercase text-zinc-500 hover:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveComment}
                  className="px-4 py-2 text-xs font-mono uppercase bg-white text-black hover:bg-zinc-200"
                >
                  Save Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
