import React, { useState, useEffect } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { CommentList } from './components/CommentList';
import { Comment } from './types';
import { Upload, Film, Github } from 'lucide-react';

function App() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [seekTo, setSeekTo] = useState<number | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setComments([]); // Clear comments for new video
    }
  };

  const handleAddComment = (newComment: Omit<Comment, 'id' | 'createdAt'>) => {
    const comment: Comment = {
      ...newComment,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setComments([...comments, comment]);
  };

  const handleCommentClick = (timestamp: number) => {
    setSeekTo(timestamp);
    // Reset seekTo after a short delay to allow re-seeking to same timestamp
    setTimeout(() => setSeekTo(null), 100);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-zinc-400 font-mono overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-black z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold text-lg">
            M
          </div>
          <h1 className="text-sm font-mono tracking-widest uppercase text-white">MonoFeedback</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 cursor-pointer transition-colors text-xs uppercase tracking-wider">
            <Upload size={14} />
            <span>Upload MP4</span>
            <input
              type="file"
              accept="video/mp4,video/webm"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {videoSrc ? (
          <>
            <div className="flex-1 flex items-center justify-center bg-zinc-950 p-8 overflow-y-auto">
              <VideoPlayer
                src={videoSrc}
                comments={comments}
                onAddComment={handleAddComment}
                seekTo={seekTo}
              />
            </div>
            <CommentList
              comments={comments}
              onCommentClick={handleCommentClick}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-4">
            <Film size={48} strokeWidth={1} />
            <p className="text-sm font-mono uppercase tracking-widest">No video loaded</p>
            <p className="text-xs text-zinc-700 max-w-md text-center">
              Upload an MP4 file to start adding feedback and annotations.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
