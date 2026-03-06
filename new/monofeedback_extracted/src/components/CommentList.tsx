import React from 'react';
import { Comment } from '../types';
import { MessageSquare, Clock, Edit2 } from 'lucide-react';

interface CommentListProps {
  comments: Comment[];
  onCommentClick: (timestamp: number) => void;
}

export function CommentList({ comments, onCommentClick }: CommentListProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full border-l border-zinc-800 bg-black w-80">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-mono uppercase text-zinc-500 tracking-wider">Feedback Log</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 text-xs font-mono">
            No feedback yet.
            <br />
            Select a timestamp to add comments.
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {comments.sort((a, b) => a.timestamp - b.timestamp).map((comment) => (
              <button
                key={comment.id}
                onClick={() => onCommentClick(comment.timestamp)}
                className="w-full text-left p-4 hover:bg-zinc-900 transition-colors group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 text-xs font-mono text-zinc-500 group-hover:text-zinc-300">
                    <Clock size={12} />
                    {formatTime(comment.timestamp)}
                  </span>
                  {comment.drawing && (
                    <span className="flex items-center gap-1 text-[10px] font-mono uppercase text-zinc-600 border border-zinc-800 px-1.5 py-0.5">
                      <Edit2 size={10} />
                      Drawing
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-300 font-mono leading-relaxed break-words">
                  {comment.text}
                </p>
                <div className="mt-2 text-[10px] text-zinc-600 font-mono uppercase">
                  {comment.author}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
