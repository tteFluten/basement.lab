"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Plus, FolderOpen, Video, Loader2, Search, ChevronDown, Link2, UserPlus, LogOut, ListChecks } from "lucide-react";
import { useSession } from "next-auth/react";
import { getCurrentProjectId } from "@/lib/currentProject";
import type { FeedbackProject } from "@/lib/feedback/types";

type SortKey = "newest" | "oldest" | "name-az" | "name-za" | "most-videos";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "name-az": "Name A–Z",
  "name-za": "Name Z–A",
  "most-videos": "Most videos",
};

function sortProjects(projects: FeedbackProject[], sort: SortKey): FeedbackProject[] {
  return [...projects].sort((a, b) => {
    switch (sort) {
      case "newest":     return b.createdAt - a.createdAt;
      case "oldest":     return a.createdAt - b.createdAt;
      case "name-az":    return a.name.localeCompare(b.name);
      case "name-za":    return b.name.localeCompare(a.name);
      case "most-videos": return (b.sessionCount ?? 0) - (a.sessionCount ?? 0);
    }
  });
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ProjectCard({
  p, index, showJoin, onJoin, onLeave,
}: {
  p: FeedbackProject; index: number;
  showJoin?: boolean;
  onJoin?: (slug: string) => Promise<void>;
  onLeave?: (slug: string) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [busy, setBusy] = useState(false);

  function handleMouseEnter() {
    const v = videoRef.current;
    if (!v || !p.thumbVideoUrl) return;
    if (v.readyState === 0) v.load();
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v || !videoReady) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (v.duration) v.currentTime = x * v.duration;
  }

  function handleMouseLeave() {
    const v = videoRef.current;
    if (!v || !videoReady) return;
    v.currentTime = 0;
  }

  async function handleJoinLeave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      if (p.isMember && onLeave) await onLeave(p.slug);
      else if (onJoin) await onJoin(p.slug);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Link
      href={`/apps/feedback/${p.slug}`}
      className="fb-card block border border-border overflow-hidden hover:border-fg-muted transition-colors bg-bg-muted group"
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
    >
      {/* Project tag strip */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-bg">
        <Link2 size={9} className="text-fg-muted/50 shrink-0" />
        {p.linkedProjectName ? (
          <span className="text-[10px] font-mono uppercase tracking-widest text-fg-muted truncate">{p.linkedProjectName}</span>
        ) : (
          <span className="text-[10px] font-mono text-fg-muted/30 italic">No project</span>
        )}
      </div>
      {/* Cover */}
      <div
        className="relative h-36 bg-[#0d0d0d] overflow-hidden flex items-center justify-center"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Static thumbnail */}
        {p.thumbThumbnailUrl && (
          <img src={p.thumbThumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {/* Video — loads on hover */}
        {p.thumbVideoUrl ? (
          <video
            ref={videoRef}
            src={p.thumbVideoUrl}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoReady ? "opacity-100" : "opacity-0"}`}
            preload="none"
            muted
            playsInline
            onLoadedMetadata={() => setVideoReady(true)}
          />
        ) : !p.thumbThumbnailUrl ? (
          <FolderOpen size={40} strokeWidth={1} className="text-white/10 group-hover:text-white/20 transition-colors" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      {/* Info */}
      <div className="p-4 space-y-1.5">
        <p className="text-sm font-mono text-fg truncate">{p.name}</p>
        {p.description ? (
          <p className="text-xs text-fg-muted line-clamp-2">{p.description}</p>
        ) : (
          <p className="text-xs text-fg-muted">{formatDate(p.createdAt)}</p>
        )}
      </div>
      {/* Bottom bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border">
        {(p.sessionCount ?? 0) > 0 ? (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-fg-muted">
            <Video size={10} />
            {p.sessionCount} {p.sessionCount === 1 ? "session" : "sessions"}
          </span>
        ) : (
          <span className="text-[11px] font-mono text-fg-muted/50">No sessions yet</span>
        )}
        {showJoin && (
          <button
            onClick={handleJoinLeave}
            disabled={busy}
            className={`ml-auto flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono uppercase border transition-colors disabled:opacity-40 ${
              p.isMember
                ? "border-border text-fg-muted hover:text-red-400 hover:border-red-400/30"
                : "border-border text-fg-muted hover:text-fg hover:border-fg-muted"
            }`}
          >
            {busy ? <Loader2 size={9} className="animate-spin" /> : p.isMember ? <LogOut size={9} /> : <UserPlus size={9} />}
            {p.isMember ? "Leave" : "Join"}
          </button>
        )}
      </div>
    </Link>
  );
}

export default function FeedbackPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const [projects, setProjects] = useState<FeedbackProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [linkedFilter, setLinkedFilter] = useState<string>("all");
  const [workProjects, setWorkProjects] = useState<{ id: string; name: string }[]>([]);
  const [newLinkedProjectId, setNewLinkedProjectId] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Auto-select the current work project (same logic as History)
    const currentId = getCurrentProjectId();
    if (currentId) {
      setLinkedFilter(currentId);
      setNewLinkedProjectId(currentId);
    }
    // Fetch all work projects for filter + create form
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setWorkProjects(Array.isArray(d?.items) ? d.items : []))
      .catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/feedback/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), linkedProjectId: newLinkedProjectId || undefined }),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects((prev) => [project, ...prev]);
        setNewName("");
        setShowForm(false);
      }
    } finally {
      setCreating(false);
    }
  }

  // Unique owners for filter dropdown
  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      if (p.ownerId && p.ownerName) map.set(p.ownerId, p.ownerName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);

  const filtered = useMemo(() => {
    let list = projects;
    if (ownerFilter !== "all") list = list.filter((p) => p.ownerId === ownerFilter);
    if (linkedFilter !== "all") list = list.filter((p) => p.linkedProjectId === linkedFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.ownerName?.toLowerCase().includes(q));
    }
    return sortProjects(list, sort);
  }, [projects, search, sort, ownerFilter, linkedFilter]);

  const myProjects = useMemo(() => filtered.filter((p) => p.isMember), [filtered]);
  const otherProjects = useMemo(() => filtered.filter((p) => !p.isMember), [filtered]);

  const handleJoin = useCallback(async (slug: string) => {
    const res = await fetch(`/api/feedback/projects/${slug}/join`, { method: "POST" });
    if (res.ok) setProjects((prev) => prev.map((p) => p.slug === slug ? { ...p, isMember: true } : p));
  }, []);

  const handleLeave = useCallback(async (slug: string) => {
    const res = await fetch(`/api/feedback/projects/${slug}/join`, { method: "DELETE" });
    if (res.ok) setProjects((prev) => prev.map((p) => p.slug === slug ? { ...p, isMember: false } : p));
  }, []);


  return (
    <div className="min-h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ListChecks size={22} strokeWidth={1.5} className="text-fg-muted/60 shrink-0" />
          <div>
            <h1 className="text-sm font-mono uppercase tracking-widest text-fg">Feedback</h1>
            {linkedFilter !== "all" && workProjects.length > 0 ? (
              <p className="text-xs text-fg-muted mt-1">
                {workProjects.find(p => p.id === linkedFilter)?.name ?? "Project"}
              </p>
            ) : (
              <p className="text-xs text-fg-muted mt-1">Video annotation and timestamped feedback</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
          >
            <Plus size={14} />
            New project
          </button>
        </div>
      </div>
      {/* New project form */}
      {showForm && (
        <form onSubmit={handleCreate} className="flex flex-col gap-2 mb-6 p-4 border border-border bg-bg-muted">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              autoFocus
              className="flex-1 bg-bg border border-border px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted"
            />
            {workProjects.length > 0 && (
              <div className="relative">
                <select
                  value={newLinkedProjectId}
                  onChange={(e) => setNewLinkedProjectId(e.target.value)}
                  className="appearance-none bg-bg border border-border pl-3 pr-7 py-2 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted cursor-pointer h-full"
                >
                  <option value="">— No project —</option>
                  {workProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase bg-fg text-bg hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewName(""); }}
              className="px-3 py-2 text-xs font-mono uppercase text-fg-muted hover:text-fg border border-border transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      {!loading && projects.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full bg-bg-muted border border-border pl-8 pr-3 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted"
            />
          </div>
          {workProjects.length > 0 && (
            <div className="relative">
              <select
                value={linkedFilter}
                onChange={(e) => setLinkedFilter(e.target.value)}
                className="appearance-none bg-bg-muted border border-border pl-3 pr-7 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted cursor-pointer"
              >
                <option value="all">All projects</option>
                {workProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
            </div>
          )}
          {owners.length > 1 && (
            <div className="relative">
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="appearance-none bg-bg-muted border border-border pl-3 pr-7 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-fg-muted cursor-pointer"
              >
                <option value="all">All users</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
            </div>
          )}
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
          {(search || ownerFilter !== "all" || linkedFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setOwnerFilter("all"); setLinkedFilter("all"); }}
              className="text-xs font-mono text-fg-muted hover:text-fg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes fb-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fb-card { animation: fb-fade-in 0.28s ease-out both; }
      `}</style>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border border-border overflow-hidden">
              <div className="animate-pulse bg-zinc-800/60 w-full h-36 flex items-center justify-center">
                <ListChecks size={36} strokeWidth={1} className="text-white/10" />
              </div>
              <div className="p-4 space-y-2">
                <div className="animate-pulse bg-zinc-800/60 h-3.5 w-3/4" />
                <div className="animate-pulse bg-zinc-800/60 h-3 w-1/2" />
              </div>
              <div className="h-9 border-t border-border" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center">
          <FolderOpen size={36} strokeWidth={1} className="mx-auto mb-4 text-fg-muted opacity-30" />
          <p className="text-xs font-mono text-fg-muted uppercase tracking-widest">No projects yet</p>
          <p className="text-xs text-fg-muted mt-2">Create a project to start collecting video feedback</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-xs font-mono text-fg-muted">No results for current filters.</div>
      ) : isAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p, index) => (
            <ProjectCard key={p.id} p={p} index={index} />
          ))}
        </div>
      ) : (
        <>
          {myProjects.length > 0 && (
            <div className="mb-8">
              <p className="text-[10px] font-mono uppercase tracking-widest text-fg-muted/50 mb-4">My projects</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {myProjects.map((p, index) => (
                  <ProjectCard key={p.id} p={p} index={index} showJoin onJoin={handleJoin} onLeave={handleLeave} />
                ))}
              </div>
            </div>
          )}
          {otherProjects.length > 0 && (
            <div>
              {myProjects.length > 0 && (
                <p className="text-[10px] font-mono uppercase tracking-widest text-fg-muted/50 mb-4">All projects</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {otherProjects.map((p, index) => (
                  <ProjectCard key={p.id} p={p} index={index} showJoin onJoin={handleJoin} onLeave={handleLeave} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
