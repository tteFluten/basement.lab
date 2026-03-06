"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, FolderOpen, Video, ArrowRight, Loader2, Search, ChevronDown } from "lucide-react";
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
    <div className="min-h-full p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm font-mono uppercase tracking-widest text-fg">MonoFeedback</h1>
          <p className="text-xs text-fg-muted mt-1">Video annotation and timestamped feedback</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
        >
          <Plus size={14} />
          New project
        </button>
      </div>

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

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-fg-muted" />
        </div>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center">
          <FolderOpen size={32} strokeWidth={1} className="mx-auto mb-3 text-fg-muted opacity-40" />
          <p className="text-xs font-mono text-fg-muted uppercase tracking-widest">No projects yet</p>
          <p className="text-xs text-fg-muted mt-1">Create a project to start collecting video feedback</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs font-mono text-fg-muted">No results for current filters.</div>
      ) : (
        <div className="flex flex-col gap-px border border-border">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/apps/feedback/${p.slug}`}
              className="group flex items-center justify-between px-4 py-3 bg-bg-muted hover:bg-bg border-b border-border last:border-b-0 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderOpen size={15} strokeWidth={1.5} className="text-fg-muted shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-mono text-fg truncate">{p.name}</p>
                  <div className="flex items-center gap-3 text-xs text-fg-muted mt-0.5">
                    {p.ownerName && <span className="truncate max-w-[120px]">{p.ownerName}</span>}
                    <span className="flex items-center gap-1 shrink-0">
                      <Video size={10} />
                      {p.sessionCount ?? 0}
                    </span>
                    <span className="shrink-0">{formatDate(p.createdAt)}</span>
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
