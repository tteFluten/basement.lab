"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Plus, Video, ArrowLeft, Loader2, MessageSquare, Search, ChevronDown,
  X, Clock, Pencil, Check, Link2, Share2, Hash, Calendar, Image, Globe,
} from "lucide-react";
import type { SessionType } from "@/lib/feedback/types";
import { useSession } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import type { FeedbackProject, FeedbackSession } from "@/lib/feedback/types";
import { FeedbackLoader } from "@/components/feedback/FeedbackLoader";

const MAX_VIDEO_MB = 500;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

async function generateVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadedmetadata", () => {
      video.currentTime = video.duration * 0.15;
    });
    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        const maxW = 800;
        const scale = Math.min(1, maxW / (video.videoWidth || maxW));
        canvas.width = Math.round((video.videoWidth || maxW) * scale);
        canvas.height = Math.round((video.videoHeight || 450) * scale);
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { URL.revokeObjectURL(url); resolve(blob); }, "image/jpeg", 0.82);
      } catch { URL.revokeObjectURL(url); resolve(null); }
    });
    video.addEventListener("error", () => { URL.revokeObjectURL(url); resolve(null); });
    video.load();
  });
}

async function uploadThumbnail(blob: Blob): Promise<string | null> {
  try {
    const res = await fetch("/api/feedback/upload/thumbnail", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: blob,
    });
    if (!res.ok) return null;
    return (await res.json()).url ?? null;
  } catch { return null; }
}

function formatDuration(s: number) {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function SessionCard({
  s, projectSlug, isSelected, onToggleSelect, onUpdate,
}: {
  s: FeedbackSession;
  projectSlug: string;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FeedbackSession>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(s.title);
  const [editDesc, setEditDesc] = useState(s.description ?? "");
  const [editVersion, setEditVersion] = useState(s.version ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const isVideoSession = !s.sessionType || s.sessionType === "video";
  const isImageSession = s.sessionType === "image";
  const isUrlSession = s.sessionType === "url";

  function handleMouseEnter() {
    if (!isVideoSession) return;
    const v = videoRef.current;
    if (!v || !s.videoUrl) return;
    if (v.readyState === 0) v.load();
    if (s.durationS) v.currentTime = s.durationS * 0.15;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isVideoSession) return;
    const v = videoRef.current;
    if (!v || !videoReady || !s.durationS) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = x * s.durationS;
  }

  function handleMouseLeave() {
    if (!isVideoSession) return;
    const v = videoRef.current;
    if (!v || !s.durationS) return;
    v.currentTime = s.durationS * 0.15;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/feedback/sessions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), description: editDesc, version: editVersion }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(s.id, { title: updated.title, description: updated.description, version: updated.version });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/share/feedback/${s.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`block border overflow-hidden bg-bg-muted group transition-all duration-200 hover:border-fg-muted ${
      isSelected ? "border-fg ring-1 ring-fg/20" : "border-border"
    }`}>
      {/* Cover */}
      <div className="relative">
        <Link href={`/apps/feedback/${projectSlug}/${s.id}`}>
          <div
            className="relative h-44 bg-[#0d0d0d] overflow-hidden"
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Static thumbnail */}
            {s.thumbnailUrl && (
              <img
                src={s.thumbnailUrl}
                alt=""
                className={`absolute inset-0 w-full h-full ${isImageSession ? "object-contain" : "object-cover"}`}
              />
            )}
            {/* Video — loads on hover, scrubs with mouse (video sessions only) */}
            {isVideoSession && s.videoUrl ? (
              <video
                ref={videoRef}
                src={s.videoUrl}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoReady ? "opacity-100" : "opacity-0"}`}
                preload="none"
                muted
                playsInline
                onLoadedMetadata={() => {
                  setVideoReady(true);
                  if (videoRef.current && s.durationS) videoRef.current.currentTime = s.durationS * 0.15;
                }}
              />
            ) : !s.thumbnailUrl ? (
              <div className="absolute inset-0 flex items-center justify-center">
                {isUrlSession ? <Globe size={36} strokeWidth={1} className="text-white/10" /> :
                 isImageSession ? <Image size={36} strokeWidth={1} className="text-white/10" /> :
                 <Video size={36} strokeWidth={1} className="text-white/10" />}
              </div>
            ) : null}
            {/* Session type badge */}
            {(isImageSession || isUrlSession) && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 border border-white/10 text-[10px] font-mono text-white/60">
                {isImageSession ? <Image size={9} /> : <Globe size={9} />}
                {isImageSession ? "Image" : "URL"}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </Link>

        {/* Selection checkbox */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(s.id); }}
          className={`absolute top-2.5 left-2.5 w-5 h-5 flex items-center justify-center border transition-all duration-150 ${
            isSelected
              ? "bg-fg border-fg text-bg opacity-100"
              : "bg-black/50 border-white/30 text-transparent opacity-0 group-hover:opacity-100"
          }`}
          title={isSelected ? "Deselect" : "Select"}
        >
          {isSelected && <Check size={11} strokeWidth={3} />}
        </button>
      </div>

      {/* Info */}
      {editing ? (
        <form onSubmit={handleSave} className="p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-bg border border-border px-2.5 py-1.5 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted"
            placeholder="Session title"
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted/50 pointer-events-none" />
              <input
                value={editVersion}
                onChange={(e) => setEditVersion(e.target.value)}
                className="w-full bg-bg border border-border pl-6 pr-2.5 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted"
                placeholder="version (e.g. v2)"
              />
            </div>
          </div>
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full bg-bg border border-border px-2.5 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted resize-none min-h-[56px]"
            placeholder="Description (optional)"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setEditing(false); setEditTitle(s.title); setEditDesc(s.description ?? ""); setEditVersion(s.version ?? ""); }}
              className="p-1 text-fg-muted hover:text-fg transition-colors">
              <X size={13} />
            </button>
            <button type="submit" disabled={saving || !editTitle.trim()}
              className="p-1 text-fg-muted hover:text-fg disabled:opacity-40 transition-colors">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 space-y-1.5">
          <div className="flex items-start gap-2">
            <p className="text-sm font-mono text-fg truncate flex-1">{s.title}</p>
            {s.version && (
              <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono border border-border text-fg-muted/60 bg-bg leading-none mt-0.5">
                <Hash size={8} />{s.version}
              </span>
            )}
          </div>
          {s.description && (
            <p className="text-xs text-fg-muted line-clamp-2">{s.description}</p>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border">
        {isUrlSession && s.sourceUrl && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-fg-muted/60 truncate max-w-[120px]" title={s.sourceUrl}>
            <Globe size={9} className="shrink-0" />
            {(() => { try { return new URL(s.sourceUrl).hostname; } catch { return s.sourceUrl; } })()}
          </span>
        )}
        {s.durationS != null && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-fg-muted">
            <Clock size={9} />
            {formatDuration(s.durationS)}
          </span>
        )}
        {(s.commentCount ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-fg-muted">
            <MessageSquare size={9} />
            {s.commentCount}
          </span>
        )}
        <span className="flex items-center gap-1 text-[11px] font-mono text-fg-muted/40">
          <Calendar size={9} />
          {formatDate(s.createdAt)}
        </span>

        {!editing && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={handleShare}
              className={`p-1 transition-colors ${copied ? "text-green-400" : "text-fg-muted/40 hover:text-fg-muted opacity-0 group-hover:opacity-100"}`}
              title="Copy share link"
            >
              {copied ? <Check size={11} /> : <Share2 size={11} />}
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setEditing(true); setEditTitle(s.title); setEditDesc(s.description ?? ""); setEditVersion(s.version ?? ""); }}
              className="p-1 text-fg-muted/40 hover:text-fg-muted transition-colors opacity-0 group-hover:opacity-100"
              title="Edit session"
            >
              <Pencil size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
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

const SESSION_TYPE_ICONS: Record<SessionType, React.ComponentType<{ size?: string | number; strokeWidth?: string | number; className?: string }>> = {
  video: Video,
  image: Image,
  url: Globe,
};

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
  const { data: authSession } = useSession();
  const isAdmin = (authSession?.user as { role?: string })?.role === "admin";
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [sessions, setSessions] = useState<FeedbackSession[]>([]);
  const [workProjects, setWorkProjects] = useState<{ id: string; name: string }[]>([]);
  const [editingProject, setEditingProject] = useState(false);
  const [editProjName, setEditProjName] = useState("");
  const [editProjDesc, setEditProjDesc] = useState("");
  const [editLinkedProjectId, setEditLinkedProjectId] = useState<string>("");
  const [savingProject, setSavingProject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("video");
  const [newUrl, setNewUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const speedRef = useRef<{ lastLoaded: number; lastTime: number }>({ lastLoaded: 0, lastTime: 0 });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyAllDone, setCopyAllDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/feedback/projects/${projectSlug}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setSessions(data.sessions ?? []);
        setWorkProjects(data.workProjects ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setNewTitle("");
    setNewVersion("");
    setNewUrl("");
    setSelectedFile(null);
    setUploadStage("idle");
    setUploadPercent(0);
    setUploadSpeed(null);
    setUploadError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadImageFile(file: File): Promise<string> {
    // Init: check mode (R2 presigned or Blob)
    const initRes = await fetch("/api/feedback/upload/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
    });
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to initialize upload");
    }
    const init = await initRes.json() as { mode: "r2" | "blob"; uploadUrl?: string; publicUrl?: string };

    if (init.mode === "r2" && init.uploadUrl && init.publicUrl) {
      // Direct PUT to R2
      const xhr = await new Promise<XMLHttpRequest>((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setUploadPercent(Math.round((e.loaded / e.total) * 100));
        });
        x.addEventListener("load", () => x.status < 400 ? resolve(x) : reject(new Error(`Upload failed (${x.status})`)));
        x.addEventListener("error", () => reject(new Error("Upload failed")));
        x.open("PUT", init.uploadUrl!);
        x.setRequestHeader("Content-Type", file.type);
        x.send(file);
      });
      void xhr;
      return init.publicUrl;
    }

    // Blob fallback
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/feedback/upload/image",
      onUploadProgress: ({ percentage }) => setUploadPercent(Math.round(percentage)),
    });
    return blob.url;
  }

  async function captureUrlScreenshot(url: string): Promise<string | null> {
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // ── URL session ──────────────────────────────────────────────────────────
    if (sessionType === "url") {
      const trimmedUrl = newUrl.trim();
      if (!trimmedUrl) { setUploadError("URL is required"); return; }
      try { new URL(trimmedUrl); } catch { setUploadError("Enter a valid URL"); return; }
      setUploadStage("saving");
      setUploadError(null);
      try {
        const res = await fetch(`/api/feedback/projects/${projectSlug}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle.trim(), sessionType: "url", sourceUrl: trimmedUrl, version: newVersion.trim() || undefined }),
        });
        if (!res.ok) { setUploadError("Failed to create session"); setUploadStage("idle"); return; }
        const newSession = await res.json();
        setSessions((prev) => [newSession, ...prev]);
        setShowForm(false);
        resetForm();
        // Capture screenshot in background → patch thumbnailUrl
        captureUrlScreenshot(trimmedUrl).then(async (screenshotUrl) => {
          if (!screenshotUrl) return;
          await fetch(`/api/feedback/sessions/${newSession.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thumbnailUrl: screenshotUrl }),
          });
          setSessions((prev) => prev.map((s) => s.id === newSession.id ? { ...s, thumbnailUrl: screenshotUrl } : s));
        }).catch(() => {});
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed");
        setUploadStage("idle");
      }
      return;
    }

    // ── Image session ────────────────────────────────────────────────────────
    if (sessionType === "image") {
      if (!selectedFile) { setUploadError("Select an image file"); return; }
      if (selectedFile.size > 20 * 1024 * 1024) { setUploadError("Image must be under 20 MB"); return; }
      setUploadError(null);
      setUploadStage("uploading");
      setUploadPercent(50);
      try {
        const imageUrl = await uploadImageFile(selectedFile);
        setUploadStage("saving");
        setUploadPercent(100);
        const res = await fetch(`/api/feedback/projects/${projectSlug}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle.trim(),
            sessionType: "image",
            videoUrl: imageUrl,
            thumbnailUrl: imageUrl, // image IS the thumbnail
            version: newVersion.trim() || undefined,
          }),
        });
        if (!res.ok) { setUploadError("Failed to create session"); setUploadStage("idle"); return; }
        const newSession = await res.json();
        setSessions((prev) => [newSession, ...prev]);
        setShowForm(false);
        resetForm();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        setUploadStage("idle");
      }
      return;
    }

    // ── Video session (existing logic) ───────────────────────────────────────
    if (selectedFile && selectedFile.size > MAX_VIDEO_BYTES) {
      setUploadError(`El video no puede superar ${MAX_VIDEO_MB}MB`);
      return;
    }

    setUploadError(null);
    setUploadStage("preparing");
    setUploadPercent(0);
    speedRef.current = { lastLoaded: 0, lastTime: Date.now() };

    // Start thumbnail generation immediately (local file, fast)
    const thumbnailBlobPromise = selectedFile ? generateVideoThumbnail(selectedFile) : Promise.resolve(null);

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
            onUploadProgress: ({ loaded, percentage }) => {
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

      // Upload thumbnail (thumbnail generation is likely already done; upload is small/fast)
      let thumbnailUrl: string | null = null;
      const thumbBlob = await thumbnailBlobPromise;
      if (thumbBlob) thumbnailUrl = await uploadThumbnail(thumbBlob);

      const res = await fetch(`/api/feedback/projects/${projectSlug}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), videoUrl, durationS, version: newVersion.trim() || undefined, thumbnailUrl }),
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

  const handleUpdateSession = useCallback((id: string, updates: Partial<FeedbackSession>) => {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function handleCopyLinks() {
    const links = Array.from(selectedIds)
      .map((id) => `${window.location.origin}/share/feedback/${id}`)
      .join("\n");
    await navigator.clipboard.writeText(links);
    setCopyAllDone(true);
    setTimeout(() => setCopyAllDone(false), 2500);
  }

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault();
    if (!editProjName.trim() || !project) return;
    setSavingProject(true);
    try {
      const res = await fetch(`/api/feedback/projects/${projectSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProjName.trim(),
          description: editProjDesc,
          linkedProjectId: editLinkedProjectId || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProject((prev) => prev ? {
          ...prev,
          name: updated.name,
          description: updated.description,
          linkedProjectId: updated.linkedProjectId,
          linkedProjectName: updated.linkedProjectName,
        } : prev);
        setEditingProject(false);
      }
    } finally {
      setSavingProject(false);
    }
  }

  const filtered = useMemo(() => {
    let list = sessions;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q) || s.version?.toLowerCase().includes(q));
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

  if (loading) return <FeedbackLoader />;

  if (!project) return (
    <div className="p-6 text-fg-muted text-sm font-mono">Project not found.</div>
  );

  return (
    <div className="min-h-full p-6 pb-24">
      <style>{`
        @keyframes fb-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fb-card { animation: fb-fade-in 0.28s ease-out both; }
      `}</style>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <Link href="/apps/feedback" className="text-fg-muted hover:text-fg transition-colors mt-0.5 shrink-0">
            <ArrowLeft size={16} />
          </Link>
          {editingProject ? (
            <form onSubmit={handleSaveProject} className="flex-1 space-y-2">
              <input
                autoFocus
                value={editProjName}
                onChange={(e) => setEditProjName(e.target.value)}
                className="w-full bg-bg border border-border px-3 py-1.5 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted uppercase tracking-widest"
                placeholder="Project name"
              />
              <textarea
                value={editProjDesc}
                onChange={(e) => setEditProjDesc(e.target.value)}
                className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted resize-none min-h-[56px]"
                placeholder="Description (optional)"
              />
              {isAdmin && workProjects.length > 0 && (
                <div className="relative">
                  <select
                    value={editLinkedProjectId}
                    onChange={(e) => setEditLinkedProjectId(e.target.value)}
                    className="w-full appearance-none bg-bg border border-border pl-3 pr-7 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted cursor-pointer"
                  >
                    <option value="">— No linked project —</option>
                    {workProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingProject(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg transition-colors">
                  <X size={12} /> Cancel
                </button>
                <button type="submit" disabled={savingProject || !editProjName.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase bg-fg text-bg hover:opacity-80 disabled:opacity-40 transition-opacity">
                  {savingProject ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
              </div>
            </form>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-mono uppercase tracking-widest text-fg truncate">{project.name}</h1>
                <button
                  onClick={() => {
                    setEditingProject(true);
                    setEditProjName(project.name);
                    setEditProjDesc(project.description ?? "");
                    setEditLinkedProjectId(project.linkedProjectId ?? "");
                  }}
                  className="shrink-0 p-0.5 text-fg-muted/40 hover:text-fg-muted transition-colors"
                  title="Edit project"
                >
                  <Pencil size={11} />
                </button>
              </div>
              {project.linkedProjectName && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Link2 size={10} className="text-fg-muted/50 shrink-0" />
                  <span className="text-[11px] font-mono text-fg-muted/60 truncate">{project.linkedProjectName}</span>
                </div>
              )}
              {project.description && (
                <p className="text-xs text-fg-muted mt-1">{project.description}</p>
              )}
              <p className="text-xs text-fg-muted/50 mt-0.5">{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</p>
            </div>
          )}
          {!editingProject && (
            <button
              onClick={() => { setShowForm((v) => !v); resetForm(); }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors shrink-0"
            >
              <Plus size={14} />
              New session
            </button>
          )}
        </div>
      </div>

      {/* New session form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-10 border border-border bg-bg">

          {/* ── Type selector ── */}
          <div className="grid grid-cols-3 border-b border-border">
            {([
              { type: "video" as SessionType, Icon: Video,  label: "Video",  desc: "Upload a video file"   },
              { type: "image" as SessionType, Icon: Image,  label: "Image",  desc: "Upload an image"       },
              { type: "url"   as SessionType, Icon: Globe,  label: "URL",    desc: "Review a live page"    },
            ]).map(({ type, Icon, label, desc }, i) => {
              const active = sessionType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setSessionType(type); setSelectedFile(null); setNewUrl(""); setUploadError(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className={`relative flex flex-col items-center justify-center gap-3 py-8 transition-all ${
                    i < 2 ? "border-r border-border" : ""
                  } ${active ? "bg-fg text-bg" : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-bg-muted/60"}`}
                >
                  <Icon size={28} strokeWidth={1.2} />
                  <div className="text-center space-y-0.5">
                    <p className="text-sm font-mono font-medium tracking-wide">{label}</p>
                    <p className={`text-[11px] font-mono ${active ? "opacity-60" : "opacity-40"}`}>{desc}</p>
                  </div>
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bg" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Fields ── */}
          <div className="p-6 space-y-5">

            {/* Title + version */}
            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-fg-muted">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    sessionType === "url"   ? "e.g. Homepage — desktop review" :
                    sessionType === "image" ? "e.g. Landing page — hero section" :
                    "e.g. Homepage walkthrough — March"
                  }
                  autoFocus
                  disabled={uploading}
                  className="w-full bg-bg-muted border border-border px-4 py-3.5 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted disabled:opacity-50 placeholder:text-fg-muted/40"
                />
              </div>
              <div className="w-32 space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-fg-muted">Version</label>
                <div className="relative">
                  <Hash size={11} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted/40 pointer-events-none" />
                  <input
                    type="text"
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                    placeholder="v1"
                    disabled={uploading}
                    className="w-full bg-bg-muted border border-border pl-8 pr-3 py-3.5 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted disabled:opacity-50 placeholder:text-fg-muted/40"
                  />
                </div>
              </div>
            </div>

            {/* URL input */}
            {!uploading && sessionType === "url" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-fg-muted">URL to review</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted/40 pointer-events-none" />
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://staging.example.com/page"
                    disabled={uploading}
                    className="w-full bg-bg-muted border border-border pl-10 pr-4 py-3.5 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted disabled:opacity-50 placeholder:text-fg-muted/40"
                  />
                </div>
                <p className="text-[11px] font-mono text-fg-muted/40 pt-0.5">
                  A screenshot will be captured automatically on creation and on every feedback note.
                </p>
              </div>
            )}

            {/* File drop zone */}
            {!uploading && (sessionType === "video" || sessionType === "image") && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-fg-muted">
                  {sessionType === "image" ? "Image file" : "Video file"}
                </label>
                <label className={`relative flex flex-col items-center justify-center gap-4 py-14 border border-dashed cursor-pointer transition-all ${
                  selectedFile
                    ? "border-fg-muted bg-bg-muted"
                    : "border-border hover:border-fg-muted hover:bg-bg-muted/40"
                }`}>
                  {selectedFile ? (
                    <>
                      <div className={`w-14 h-14 flex items-center justify-center border ${selectedFile ? "border-fg-muted/30 bg-bg" : "border-border"}`}>
                        {sessionType === "image"
                          ? <Image size={26} strokeWidth={1.2} className="text-fg" />
                          : <Video size={26} strokeWidth={1.2} className="text-fg" />}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-mono text-fg truncate max-w-xs px-4">{selectedFile.name}</p>
                        <p className="text-xs font-mono text-fg-muted/60 mt-1">{formatSize(selectedFile.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                        className="absolute top-4 right-4 p-1.5 text-fg-muted hover:text-fg border border-border hover:border-fg-muted transition-colors bg-bg"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 flex items-center justify-center border border-border">
                        {sessionType === "image"
                          ? <Image size={26} strokeWidth={1} className="text-fg-muted/50" />
                          : <Video size={26} strokeWidth={1} className="text-fg-muted/50" />}
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-mono text-fg-muted">
                          {sessionType === "image" ? "Click or drag an image here" : "Click or drag a video here"}
                        </p>
                        <p className="text-xs font-mono text-fg-muted/40">
                          {sessionType === "image" ? "JPEG · PNG · WebP · GIF — max 20 MB" : `MP4 · WebM · MOV — max ${MAX_VIDEO_MB} MB`}
                        </p>
                      </div>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={sessionType === "image"
                      ? "image/jpeg,image/png,image/webp,image/gif"
                      : "video/mp4,video/webm,video/quicktime"}
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

            {/* Progress bar */}
            {uploading && (
              <div className="space-y-3 py-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-mono font-bold text-fg tabular-nums leading-none">
                      {uploadStage === "preparing" ? "—" : uploadStage === "saving" ? "100" : uploadPercent}
                      {uploadStage !== "preparing" && <span className="text-xl text-fg-muted ml-1">%</span>}
                    </p>
                    <p className="text-xs font-mono text-fg-muted mt-2">{stageLabel}</p>
                  </div>
                  <div className="text-right">
                    {uploadSpeed && uploadStage === "uploading" && (
                      <p className="text-sm font-mono text-fg">{uploadSpeed}</p>
                    )}
                    {selectedFile && (
                      <p className="text-xs font-mono text-fg-muted/60 mt-0.5">{formatSize(selectedFile.size)}</p>
                    )}
                  </div>
                </div>
                <div className="h-1 bg-border overflow-hidden">
                  <div
                    className="h-full bg-fg transition-all duration-300 ease-out"
                    style={{
                      width: uploadStage === "preparing" ? "3%" :
                             uploadStage === "saving"    ? "100%" :
                             `${uploadPercent}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {uploadError && (
              <div className="flex items-center gap-2.5 px-4 py-3 border border-red-500/20 bg-red-500/5 text-red-400">
                <X size={13} className="shrink-0" />
                <p className="text-sm font-mono">{uploadError}</p>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex border-t border-border">
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              disabled={uploading}
              className="flex-1 py-4 text-sm font-mono uppercase tracking-widest text-fg-muted hover:text-fg hover:bg-bg-muted border-r border-border transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !newTitle.trim() || (sessionType === "url" && !newUrl.trim())}
              className="flex-[2] flex items-center justify-center gap-2.5 py-4 text-sm font-mono uppercase tracking-widest bg-fg text-bg hover:opacity-85 disabled:opacity-30 transition-opacity"
            >
              {uploading
                ? <><Loader2 size={14} className="animate-spin" />{stageLabel}</>
                : <>
                    {sessionType === "video" && <Video size={14} strokeWidth={1.5} />}
                    {sessionType === "image" && <Image size={14} strokeWidth={1.5} />}
                    {sessionType === "url"   && <Globe size={14} strokeWidth={1.5} />}
                    Create {sessionType} session
                  </>}
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
              <SessionCard
                s={s}
                projectSlug={projectSlug}
                isSelected={selectedIds.has(s.id)}
                onToggleSelect={handleToggleSelect}
                onUpdate={handleUpdateSession}
              />
            </div>
          ))}
        </div>
      )}

      {/* Multi-select floating action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-1 py-1 bg-fg text-bg shadow-2xl">
          <span className="px-3 py-1.5 text-xs font-mono uppercase tracking-widest opacity-70">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-5 bg-bg/20 mx-1" />
          <button
            onClick={handleCopyLinks}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase hover:bg-bg/10 transition-colors"
          >
            {copyAllDone ? <Check size={12} /> : <Share2 size={12} />}
            {copyAllDone ? "Copied!" : "Copy links"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-2 hover:bg-bg/10 transition-colors"
            title="Clear selection"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
