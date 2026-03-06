"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, FolderOpen, Video, ArrowRight, Loader2, Search, ChevronDown, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
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

export default function FeedbackPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const [corsStatus, setCorsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [corsError, setCorsError] = useState<string | null>(null);
  const [projects, setProjects] = useState<FeedbackProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/feedback/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
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
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.ownerName?.toLowerCase().includes(q));
    }
    return sortProjects(list, sort);
  }, [projects, search, sort, ownerFilter]);

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-full p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm font-mono uppercase tracking-widest text-fg">MonoFeedback</h1>
          <p className="text-xs text-fg-muted mt-1">Video annotation and timestamped feedback</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={async () => {
                setCorsStatus("loading");
                setCorsError(null);
                try {
                  const res = await fetch("/api/feedback/setup-cors", { method: "POST" });
                  const data = await res.json();
                  if (res.ok) { setCorsStatus("ok"); }
                  else { setCorsStatus("error"); setCorsError(data.error ?? JSON.stringify(data)); }
                } catch { setCorsStatus("error"); setCorsError("Network error"); }
              }}
              disabled={corsStatus === "loading"}
              title="Setup R2 CORS"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors disabled:opacity-40"
            >
              {corsStatus === "loading" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {corsStatus === "ok" ? "CORS OK" : corsStatus === "error" ? "CORS ERR" : "Setup CORS"}
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
          >
            <Plus size={14} />
            New project
          </button>
        </div>
      </div>
      {corsStatus === "error" && corsError && (
        <p className="text-xs font-mono text-red-400 mb-4">{corsError}</p>
      )}

      {/* New project form */}
      {showForm && (
        <form onSubmit={handleCreate} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            autoFocus
            className="flex-1 bg-bg-muted border border-border px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-fg-muted"
          />
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
          {(search || ownerFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setOwnerFilter("all"); }}
              className="text-xs font-mono text-fg-muted hover:text-fg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes fb-fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fb-card { animation: fb-fade-in 0.25s ease-out both; }
        @keyframes fb-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        .fb-shimmer::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent); animation:fb-shimmer 1.4s infinite; }
      `}</style>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-border overflow-hidden">
              <div className="relative fb-shimmer h-36 bg-bg-muted" />
              <div className="p-4 space-y-2">
                <div className="relative fb-shimmer h-3 w-3/4 bg-bg-muted rounded" />
                <div className="relative fb-shimmer h-2.5 w-1/2 bg-bg-muted rounded" />
              </div>
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, index) => (
            <Link
              key={p.id}
              href={`/apps/feedback/${p.slug}`}
              className="fb-card group border border-border overflow-hidden hover:border-fg-muted transition-colors bg-bg-muted"
              style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
            >
              {/* Cover */}
              <div className="relative h-36 bg-[#0d0d0d] flex items-center justify-center overflow-hidden">
                <FolderOpen size={40} strokeWidth={1} className="text-white/10 group-hover:text-white/20 transition-colors" />
                {(p.sessionCount ?? 0) > 0 && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 border border-white/10 px-2 py-1 text-[11px] font-mono text-white/60">
                    <Video size={10} />
                    {p.sessionCount}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {/* Info */}
              <div className="p-4">
                <p className="text-sm font-mono text-fg truncate mb-1">{p.name}</p>
                <div className="flex items-center justify-between text-xs text-fg-muted">
                  {p.ownerName
                    ? <span className="truncate max-w-[140px]">{p.ownerName}</span>
                    : <span />}
                  <span className="shrink-0 tabular-nums">{formatDate(p.createdAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
