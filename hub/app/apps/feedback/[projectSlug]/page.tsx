"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Video, ArrowLeft, ArrowRight, Loader2, MessageSquare, Search, ChevronDown, X } from "lucide-react";
import type { FeedbackProject, FeedbackSession } from "@/lib/feedback/types";

const MAX_VIDEO_MB = 500;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

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
        // Step 1: get presigned PUT URL from server
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
          throw new Error(err.error ?? "Failed to get upload URL");
        }
        const { uploadUrl, publicUrl } = await initRes.json() as { uploadUrl: string; publicUrl: string };

        // Step 2: upload directly to R2 via XHR for real progress
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
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", selectedFile.type);
          xhr.send(selectedFile);
        });

        videoUrl = publicUrl;

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

  function formatDuration(s: number | null) {
    if (!s) return null;
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const uploading = uploadStage !== "idle";
  const stageLabel = {
    idle: "",
    preparing: "Preparing…",
    uploading: `Uploading ${uploadPercent}%`,
    saving: "Saving…",
  }[uploadStage];

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
        <form onSubmit={handleCreate} className="mb-6 border border-border bg-bg-muted">
          <div className="flex flex-col gap-3 p-4">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Session title"
              autoFocus
              disabled={uploading}
              className="bg-bg border border-border px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted disabled:opacity-50"
            />

            {/* File picker */}
            {!uploading && (
              <label className={`flex items-center gap-2 px-3 py-2 border border-dashed text-xs font-mono transition-colors cursor-pointer ${
                selectedFile ? "border-fg-muted text-fg" : "border-border text-fg-muted hover:text-fg hover:border-fg-muted"
              }`}>
                <Video size={14} className="shrink-0" />
                <span className="truncate flex-1">
                  {selectedFile
                    ? `${selectedFile.name} — ${formatSize(selectedFile.size)}`
                    : `Choose video — MP4, WebM, MOV · max ${MAX_VIDEO_MB}MB`}
                </span>
                {selectedFile && (
                  <span
                    role="button"
                    onClick={(e) => { e.preventDefault(); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    className="text-fg-muted hover:text-fg shrink-0"
                  >
                    <X size={12} />
                  </span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setUploadError(null); }}
                  className="hidden"
                />
              </label>
            )}

            {/* Progress bar */}
            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-fg-muted">{stageLabel}</span>
                  <div className="flex items-center gap-3 text-fg-muted">
                    {uploadSpeed && uploadStage === "uploading" && <span>{uploadSpeed}</span>}
                    {selectedFile && <span>{formatSize(selectedFile.size)}</span>}
                  </div>
                </div>
                <div className="h-0.5 bg-border overflow-hidden">
                  <div
                    className="h-full bg-fg transition-all duration-200 ease-out"
                    style={{
                      width: uploadStage === "preparing" ? "4%" :
                             uploadStage === "saving"    ? "100%" :
                             `${uploadPercent}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <p className="text-xs font-mono text-red-400">{uploadError}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-0 border-t border-border">
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              disabled={uploading}
              className="flex-1 py-2 text-xs font-mono uppercase text-fg-muted hover:text-fg hover:bg-bg border-r border-border transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !newTitle.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-mono uppercase bg-fg text-bg hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {uploading
                ? <><Loader2 size={12} className="animate-spin" /> {stageLabel}</>
                : "Create session"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
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
        <div className="border border-dashed border-border p-12 text-center">
          <Video size={32} strokeWidth={1} className="mx-auto mb-3 text-fg-muted opacity-40" />
          <p className="text-xs font-mono text-fg-muted uppercase tracking-widest">No sessions yet</p>
          <p className="text-xs text-fg-muted mt-1">Add a video to start collecting feedback</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs font-mono text-fg-muted">No results for current filters.</div>
      ) : (
        <div className="flex flex-col gap-px border border-border">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/apps/feedback/${projectSlug}/${s.id}`}
              className="group flex items-center justify-between px-4 py-3 bg-bg-muted hover:bg-bg border-b border-border last:border-b-0 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Video size={15} strokeWidth={1.5} className="text-fg-muted shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-mono text-fg truncate">{s.title}</p>
                  <div className="flex items-center gap-3 text-xs text-fg-muted mt-0.5">
                    {s.durationS != null && <span className="shrink-0">{formatDuration(s.durationS)}</span>}
                    <span className="flex items-center gap-1 shrink-0">
                      <MessageSquare size={10} />
                      {s.commentCount ?? 0}
                    </span>
                    <span className="shrink-0">{new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
              </div>
              <ArrowRight size={14} className="text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
