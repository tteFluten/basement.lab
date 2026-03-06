"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Video, ArrowLeft, Loader2, MessageSquare, Search, ChevronDown, X, Clock } from "lucide-react";
import { upload } from "@vercel/blob/client";
import type { FeedbackProject, FeedbackSession } from "@/lib/feedback/types";

const MAX_VIDEO_MB = 500;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-800/60 ${className ?? ""}`} />;
}

function formatDuration(s: number) {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SessionCard({ s, projectSlug }: { s: FeedbackSession; projectSlug: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  function handleMouseEnter() {
    const v = videoRef.current;
    if (!v || !s.videoUrl) return;
    if (v.readyState === 0) v.load();
    if (s.durationS) v.currentTime = s.durationS * 0.15;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v || !videoReady || !s.durationS) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = x * s.durationS;
  }

  function handleMouseLeave() {
    const v = videoRef.current;
    if (!v || !s.durationS) return;
    v.currentTime = s.durationS * 0.15;
  }

  return (
    <Link
      href={`/apps/feedback/${projectSlug}/${s.id}`}
      className="block border border-border overflow-hidden bg-bg-muted group transition-colors hover:border-fg-muted"
    >
      {/* Cover */}
      <div
        className="relative h-44 bg-[#0d0d0d] overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {s.videoUrl ? (
          <video
            ref={videoRef}
            src={s.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            preload="none"
            muted
            playsInline
            onLoadedMetadata={() => {
              setVideoReady(true);
              if (videoRef.current && s.durationS) videoRef.current.currentTime = s.durationS * 0.15;
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Video size={36} strokeWidth={1} className="text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Info */}
      <div className="p-4 space-y-1.5">
        <p className="text-sm font-mono text-fg truncate">{s.title}</p>
        <p className="text-xs text-fg-muted">{formatDate(s.createdAt)}</p>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border">
        {s.durationS != null && (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-fg-muted">
            <Clock size={10} />
            {formatDuration(s.durationS)}
          </span>
        )}
        {(s.commentCount ?? 0) > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-fg-muted">
            <MessageSquare size={10} />
            {s.commentCount}
          </span>
        )}
      </div>
    </Link>
  );
}

type SortKey = "newest" | "oldest" | "name-az" | "most-comments";
const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "name-az": "Name A–Z",
  "most-comments": "Most comments",
};

type UploadStage = "idle" | "preparing" | "uploading" | "saving";

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function sortSessions(sessions: FeedbackSession[], sort: SortKey): FeedbackSession[] {
  return [...sessions].sort((a, b) => {
    switch (sort) {
      case "newest":        return b.createdAt - a.createdAt;
      case "oldest":        return a.createdAt - b.createdAt;
      case "name-az":       return a.title.localeCompare(b.title);
      case "most-comments": return (b.commentCount ?? 0) - (a.commentCount ?? 0);
    }
  });
}

export default function ProjectPage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [sessions, setSessions] = useState<FeedbackSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const speedRef = useRef<{ lastLoaded: number; lastTime: number }>({ lastLoaded: 0, lastTime: 0 });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

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

  function resetForm() {
    setNewTitle("");
    setSelectedFile(null);
    setUploadStage("idle");
    setUploadPercent(0);
    setUploadSpeed(null);
    setUploadError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (selectedFile && selectedFile.size > MAX_VIDEO_BYTES) {
      setUploadError(`El video no puede superar ${MAX_VIDEO_MB}MB`);
      return;
    }

    setUploadError(null);
    setUploadStage("preparing");
    setUploadPercent(0);
    speedRef.current = { lastLoaded: 0, lastTime: Date.now() };

    try {
      let videoUrl: string | null = null;
      let durationS: number | null = null;

      if (selectedFile) {
        const initRes = await fetch("/api/feedback/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: selectedFile.name,
            contentType: selectedFile.type,
            size: selectedFile.size,
          }),
        });
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to initialize upload");
        }
        const init = await initRes.json() as { mode: "r2" | "blob"; uploadUrl?: string; publicUrl?: string };

        if (init.mode === "r2" && init.uploadUrl && init.publicUrl) {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (e) => {
              setUploadStage("uploading");
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                setUploadPercent(pct);
                const now = Date.now();
                const dt = (now - speedRef.current.lastTime) / 1000;
                if (dt >= 0.3) {
                  const speed = (e.loaded - speedRef.current.lastLoaded) / dt;
                  setUploadSpeed(formatSpeed(speed));
                  speedRef.current = { lastLoaded: e.loaded, lastTime: now };
                }
              }
            });
            xhr.addEventListener("load", () =>
              xhr.status < 400 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))
            );
            xhr.addEventListener("error", () => reject(new Error("Upload failed")));
            xhr.open("PUT", init.uploadUrl!);
            xhr.setRequestHeader("Content-Type", selectedFile.type);
            xhr.send(selectedFile);
          });
          videoUrl = init.publicUrl;
        } else {
          const blob = await upload(selectedFile.name, selectedFile, {
            access: "public",
            handleUploadUrl: "/api/feedback/upload",
            onUploadProgress: ({ loaded, total, percentage }) => {
              setUploadStage("uploading");
              setUploadPercent(Math.round(percentage));
              const now = Date.now();
              const dt = (now - speedRef.current.lastTime) / 1000;
              if (dt >= 0.3) {
                const speed = (loaded - speedRef.current.lastLoaded) / dt;
                setUploadSpeed(formatSpeed(speed));
                speedRef.current = { lastLoaded: loaded, lastTime: now };
              }
            },
          });
          videoUrl = blob.url;
        }

        try {
          durationS = await new Promise((resolve) => {
            const v = document.createElement("video");
            v.src = URL.createObjectURL(selectedFile);
            v.onloadedmetadata = () => resolve(v.duration);
            v.onerror = () => resolve(null);
          });
        } catch { /* ignore */ }
      }

      setUploadStage("saving");
      setUploadPercent(100);
      const res = await fetch(`/api/feedback/projects/${projectSlug}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), videoUrl, durationS }),
      });

      if (res.ok) {
        const session = await res.json();
        setSessions((prev) => [session, ...prev]);
        setShowForm(false);
        resetForm();
      } else {
        setUploadError("Failed to create session");
        setUploadStage("idle");
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadStage("idle");
    }
  }

  const filtered = useMemo(() => {
    let list = sessions;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q));
    }
    return sortSessions(list, sort);
  }, [sessions, search, sort]);

  const uploading = uploadStage !== "idle";
  const stageLabel = {
    idle: "",
    preparing: "Preparing…",
    uploading: `Uploading ${uploadPercent}%`,
    saving: "Saving…",
  }[uploadStage];

  const GRID = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";

  if (loading) return (
    <div className="min-h-full p-6">
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="w-4 h-4" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className={GRID}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border border-border overflow-hidden">
            <Skeleton className="w-full h-44" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <div className="h-9 border-t border-border" />
          </div>
        ))}
      </div>
    </div>
  );

  if (!project) return (
    <div className="p-6 text-fg-muted text-sm font-mono">Project not found.</div>
  );

  return (
    <div className="min-h-full p-6">
      <style>{`
        @keyframes fb-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fb-card { animation: fb-fade-in 0.28s ease-out both; }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/apps/feedback" className="text-fg-muted hover:text-fg transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-sm font-mono uppercase tracking-widest text-fg">{project.name}</h1>
          <p className="text-xs text-fg-muted mt-0.5">{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); resetForm(); }}
          className="flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
        >
          <Plus size={14} />
          Add video
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 border border-border">
          <div className="flex flex-col gap-4 p-6">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-fg-muted">Session title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Homepage review — March"
                autoFocus
                disabled={uploading}
                className="bg-bg border border-border px-4 py-3 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted disabled:opacity-50 placeholder:text-fg-muted/50"
              />
            </div>

            {/* File picker */}
            {!uploading && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-widest text-fg-muted">Video file</label>
                <label className={`relative flex flex-col items-center justify-center gap-3 py-8 border border-dashed transition-colors cursor-pointer ${
                  selectedFile
                    ? "border-fg-muted bg-bg-muted"
                    : "border-border hover:border-fg-muted hover:bg-bg-muted/50"
                }`}>
                  {selectedFile ? (
                    <>
                      <Video size={28} strokeWidth={1.5} className="text-fg" />
                      <div className="text-center">
                        <p className="text-sm font-mono text-fg truncate max-w-xs px-4">{selectedFile.name}</p>
                        <p className="text-xs font-mono text-fg-muted mt-1">{formatSize(selectedFile.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                        className="absolute top-3 right-3 p-1 text-fg-muted hover:text-fg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Video size={28} strokeWidth={1} className="text-fg-muted opacity-60" />
                      <div className="text-center">
                        <p className="text-sm font-mono text-fg-muted">Choose a video file</p>
                        <p className="text-xs text-fg-muted/60 mt-1">MP4, WebM or MOV · max {MAX_VIDEO_MB} MB</p>
                      </div>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setSelectedFile(file);
                      setUploadError(null);
                      if (file && !newTitle.trim()) {
                        const auto = file.name
                          .replace(/\.[^/.]+$/, "")
                          .replace(/[-_.]+/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())
                          .trim();
                        setNewTitle(auto);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Progress */}
            {uploading && (
              <div className="flex flex-col gap-4 py-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-mono font-bold text-fg tabular-nums leading-none">
                      {uploadStage === "preparing" ? "—"
                        : uploadStage === "saving" ? "100"
                        : uploadPercent}
                      {uploadStage !== "preparing" && <span className="text-lg text-fg-muted ml-0.5">%</span>}
                    </p>
                    <p className="text-xs font-mono text-fg-muted mt-1">{stageLabel}</p>
                  </div>
                  <div className="text-right">
                    {uploadSpeed && uploadStage === "uploading" && (
                      <p className="text-sm font-mono text-fg">{uploadSpeed}</p>
                    )}
                    {selectedFile && (
                      <p className="text-xs font-mono text-fg-muted mt-0.5">{formatSize(selectedFile.size)}</p>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-border overflow-hidden rounded-full">
                  <div
                    className="h-full bg-fg transition-all duration-300 ease-out rounded-full"
                    style={{
                      width: uploadStage === "preparing" ? "3%" :
                             uploadStage === "saving"    ? "100%" :
                             `${uploadPercent}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <p className="text-sm font-mono text-red-400 flex items-center gap-2">
                <X size={14} className="shrink-0" />
                {uploadError}
              </p>
            )}
          </div>

          <div className="flex border-t border-border">
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              disabled={uploading}
              className="flex-1 py-3 text-xs font-mono uppercase text-fg-muted hover:text-fg hover:bg-bg-muted border-r border-border transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !newTitle.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono uppercase bg-fg text-bg hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {uploading
                ? <><Loader2 size={13} className="animate-spin" /> {stageLabel}</>
                : "Create session"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions…"
              className="w-full bg-bg-muted border border-border pl-8 pr-3 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted"
            />
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="appearance-none bg-bg-muted border border-border pl-3 pr-7 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted cursor-pointer"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
          </div>
          {search && (
            <button onClick={() => setSearch("")} className="text-xs font-mono text-fg-muted hover:text-fg transition-colors">Clear</button>
          )}
        </div>
      )}

      {/* Session list */}
      {sessions.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center">
          <Video size={36} strokeWidth={1} className="mx-auto mb-4 text-fg-muted opacity-30" />
          <p className="text-xs font-mono text-fg-muted uppercase tracking-widest">No sessions yet</p>
          <p className="text-xs text-fg-muted mt-2">Add a video to start collecting feedback</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-xs font-mono text-fg-muted">No results for current filters.</div>
      ) : (
        <div className={GRID}>
          {filtered.map((s, index) => (
            <div key={s.id} className="fb-card" style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}>
              <SessionCard s={s} projectSlug={projectSlug} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
