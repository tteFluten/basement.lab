"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Video, ArrowLeft, ArrowRight, Loader2, MessageSquare } from "lucide-react";
import { upload } from "@vercel/blob/client";
import type { FeedbackProject, FeedbackSession } from "@/lib/feedback/types";

const MAX_VIDEO_MB = 500;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export default function ProjectPage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [sessions, setSessions] = useState<FeedbackSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/feedback/projects/${projectSlug}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setSessions(data.sessions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (selectedFile && selectedFile.size > MAX_VIDEO_BYTES) {
      setUploadProgress(`El video no puede superar ${MAX_VIDEO_MB}MB`);
      return;
    }

    setUploading(true);
    setUploadProgress("Uploading video…");

    try {
      let videoUrl: string | null = null;
      let durationS: number | null = null;

      if (selectedFile) {
        // Direct browser → Vercel Blob upload (bypasses server payload limits)
        const blob = await upload(selectedFile.name, selectedFile, {
          access: "public",
          handleUploadUrl: "/api/feedback/upload",
        });
        videoUrl = blob.url;

        // Get duration via a temporary video element
        try {
          durationS = await new Promise((resolve) => {
            const v = document.createElement("video");
            v.src = URL.createObjectURL(selectedFile);
            v.onloadedmetadata = () => resolve(v.duration);
            v.onerror = () => resolve(null);
          });
        } catch { /* ignore */ }
      }

      setUploadProgress("Creating session…");
      const res = await fetch(`/api/feedback/projects/${projectSlug}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), videoUrl, durationS }),
      });

      if (res.ok) {
        const session = await res.json();
        setSessions((prev) => [session, ...prev]);
        setNewTitle("");
        setSelectedFile(null);
        setShowForm(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function formatDuration(s: number | null) {
    if (!s) return null;
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-full">
      <Loader2 size={20} className="animate-spin text-fg-muted" />
    </div>
  );

  if (!project) return (
    <div className="p-6 text-fg-muted text-sm font-mono">Project not found.</div>
  );

  return (
    <div className="min-h-full p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/apps/feedback" className="text-fg-muted hover:text-fg transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-sm font-mono uppercase tracking-widest text-fg">{project.name}</h1>
          <p className="text-xs text-fg-muted mt-0.5">{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
        >
          <Plus size={14} />
          Add video
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 mb-6 p-4 border border-border bg-bg-muted">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Session title"
            autoFocus
            className="bg-bg border border-border px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted"
          />
          <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border text-xs font-mono text-fg-muted hover:text-fg hover:border-fg-muted cursor-pointer transition-colors">
            <Video size={14} />
            {selectedFile ? `${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB)` : `Choose video — MP4, WebM, MOV · max ${MAX_VIDEO_MB}MB`}
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          {uploadProgress && (
            <p className="text-xs font-mono text-fg-muted">{uploadProgress}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewTitle(""); setSelectedFile(null); }}
              className="px-3 py-2 text-xs font-mono uppercase text-fg-muted hover:text-fg border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !newTitle.trim()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase bg-fg text-bg hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {uploading ? <><Loader2 size={12} className="animate-spin" /> {uploadProgress}</> : "Create session"}
            </button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center">
          <Video size={32} strokeWidth={1} className="mx-auto mb-3 text-fg-muted opacity-40" />
          <p className="text-xs font-mono text-fg-muted uppercase tracking-widest">No sessions yet</p>
          <p className="text-xs text-fg-muted mt-1">Add a video to start collecting feedback</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/apps/feedback/${projectSlug}/${s.id}`}
              className="group flex items-center justify-between px-4 py-3 border border-border hover:border-fg-muted bg-bg-muted hover:bg-bg transition-all"
            >
              <div className="flex items-center gap-3">
                <Video size={16} strokeWidth={1.5} className="text-fg-muted shrink-0" />
                <div>
                  <p className="text-sm font-mono text-fg">{s.title}</p>
                  <div className="flex items-center gap-3 text-xs text-fg-muted mt-0.5">
                    {s.durationS != null && <span>{formatDuration(s.durationS)}</span>}
                    <span className="flex items-center gap-1">
                      <MessageSquare size={10} />
                      {s.commentCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>
              <ArrowRight size={14} className="text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
