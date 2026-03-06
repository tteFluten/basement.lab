"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, FolderOpen, Video, ArrowRight, Loader2 } from "lucide-react";
import type { FeedbackProject } from "@/lib/feedback/types";

export default function FeedbackPage() {
  const [projects, setProjects] = useState<FeedbackProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);

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

  return (
    <div className="min-h-full p-6 max-w-3xl mx-auto">
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
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/apps/feedback/${p.slug}`}
              className="group flex items-center justify-between px-4 py-3 border border-border hover:border-fg-muted bg-bg-muted hover:bg-bg transition-all"
            >
              <div className="flex items-center gap-3">
                <FolderOpen size={16} strokeWidth={1.5} className="text-fg-muted" />
                <div>
                  <p className="text-sm font-mono text-fg">{p.name}</p>
                  <p className="text-xs text-fg-muted mt-0.5">
                    <Video size={10} className="inline mr-1" />
                    {p.sessionCount ?? 0} {p.sessionCount === 1 ? "video" : "videos"}
                  </p>
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
