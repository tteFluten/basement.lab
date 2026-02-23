"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Pencil, Check, X, Trash2, ExternalLink, Plus } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { IconPicker } from "@/components/IconPicker";

interface SubmittedApp {
  id: string;
  title: string;
  description: string;
  deployLink: string;
  editLink: string | null;
  thumbnailUrl: string | null;
  icon: string | null;
  version: string;
  tags: string[];
  createdAt: number;
  submittedBy: string | null;
  external: boolean;
}

const iconMap = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>;

function AppIcon({ name }: { name: string | null }) {
  if (!name || !iconMap[name]) return null;
  const Icon = iconMap[name];
  return <Icon size={16} strokeWidth={1.5} />;
}

export default function AdminSubmittedAppsPage() {
  const [apps, setApps] = useState<SubmittedApp[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", deployLink: "", editLink: "", version: "", tags: "", icon: null as string | null, external: false });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);

  const fetchApps = useCallback(() => {
    setLoading(true);
    fetch("/api/submitted-apps?limit=500")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.items)) setApps(d.items); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const filtered = search.trim()
    ? apps.filter((a) => {
        const q = search.toLowerCase();
        return a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.submittedBy ?? "").toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q));
      })
    : apps;

  const startEdit = (app: SubmittedApp) => {
    setEditingId(app.id);
    setEditForm({
      title: app.title,
      description: app.description,
      deployLink: app.deployLink,
      editLink: app.editLink ?? "",
      version: app.version,
      tags: app.tags.join(", "),
      icon: app.icon,
      external: Boolean(app.external),
    });
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async () => {
    if (!editingId || saving) return;
    setSaving(true);
    try {
      const tags = editForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`/api/submitted-apps/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          deployLink: editForm.deployLink,
          editLink: editForm.editLink,
          version: editForm.version,
          tags,
          icon: editForm.icon,
          external: editForm.external,
        }),
      });
      if (res.ok) { setEditingId(null); fetchApps(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this submitted app?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/submitted-apps/${id}`, { method: "DELETE" });
      if (res.ok) fetchApps();
    } finally { setDeletingId(null); }
  };

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <div>
          <h1 className="text-lg font-medium text-fg">Submitted Apps</h1>
          <p className="text-xs text-fg-muted mt-1">{apps.length} app{apps.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2 border border-border px-3 py-1.5 w-64">
          <Search className="w-4 h-4 text-fg-muted shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="bg-transparent text-sm text-fg outline-none w-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-bg-muted animate-pulse border border-border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-fg-muted py-8 text-center">
          {apps.length === 0 ? "No submitted apps yet." : "No apps match your search."}
        </p>
      ) : (
        <div className="border border-border divide-y divide-border">
          {filtered.map((app) => {
            const isEditing = editingId === app.id;

            if (isEditing) {
              return (
                <div key={app.id} className="p-4 bg-bg-muted/30 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-fg-muted uppercase tracking-wider block mb-1">Title</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full bg-bg border border-border px-3 py-2 text-sm text-fg outline-none focus:border-fg-muted"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-fg-muted uppercase tracking-wider block mb-1">Version</label>
                      <input
                        type="text"
                        value={editForm.version}
                        onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                        className="w-full bg-bg border border-border px-3 py-2 text-sm text-fg outline-none focus:border-fg-muted"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-fg-muted uppercase tracking-wider block mb-1">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full bg-bg border border-border px-3 py-2 text-sm text-fg outline-none focus:border-fg-muted min-h-[60px] resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-fg-muted uppercase tracking-wider block mb-1">Deploy Link</label>
                      <input
                        type="text"
                        value={editForm.deployLink}
                        onChange={(e) => setEditForm({ ...editForm, deployLink: e.target.value })}
                        className="w-full bg-bg border border-border px-3 py-2 text-sm text-fg outline-none focus:border-fg-muted"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-fg-muted uppercase tracking-wider block mb-1">Edit Link (optional)</label>
                      <input
                        type="text"
                        value={editForm.editLink}
                        onChange={(e) => setEditForm({ ...editForm, editLink: e.target.value })}
                        className="w-full bg-bg border border-border px-3 py-2 text-sm text-fg outline-none focus:border-fg-muted"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-fg-muted uppercase tracking-wider block mb-1">Tags (comma separated)</label>
                      <input
                        type="text"
                        value={editForm.tags}
                        onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                        className="w-full bg-bg border border-border px-3 py-2 text-sm text-fg outline-none focus:border-fg-muted"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-fg-muted uppercase tracking-wider block mb-1">Icon</label>
                      <button
                        type="button"
                        onClick={() => setIconPickerFor(app.id)}
                        className="flex items-center gap-2 w-full bg-bg border border-border px-3 py-2 text-sm text-fg hover:border-fg-muted transition-colors"
                      >
                        {editForm.icon ? (
                          <>
                            <AppIcon name={editForm.icon} />
                            <span>{editForm.icon}</span>
                          </>
                        ) : (
                          <span className="text-fg-muted">Select icon...</span>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.external}
                        onChange={(e) => setEditForm({ ...editForm, external: e.target.checked })}
                        className="rounded border-border text-fg focus:ring-fg-muted"
                      />
                      <span className="text-xs text-fg">External (open in new tab)</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-fg text-bg text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-fg-muted text-xs hover:text-fg hover:border-fg-muted"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={app.id} className="px-4 py-3 flex items-center gap-4 hover:bg-bg-muted/20 transition-colors group">
                <div className="w-10 h-10 flex items-center justify-center border border-border bg-bg-muted text-fg-muted shrink-0 overflow-hidden">
                  {app.thumbnailUrl ? (
                    <img src={app.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : app.icon ? (
                    <AppIcon name={app.icon} />
                  ) : (
                    <Plus className="w-3.5 h-3.5 opacity-30" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg truncate">{app.title}</span>
                    <span className="text-[10px] text-fg-muted">v{app.version}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {app.submittedBy && <span className="text-xs text-fg-muted">{app.submittedBy}</span>}
                    {app.submittedBy && <span className="text-fg-muted">·</span>}
                    <span className="text-xs text-fg-muted">{fmtDate(app.createdAt)}</span>
                    {app.tags.length > 0 && (
                      <>
                        <span className="text-fg-muted">·</span>
                        <span className="text-[10px] text-fg-muted">{app.tags.join(", ")}</span>
                      </>
                    )}
                  </div>
                </div>

                <a
                  href={app.deployLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg-muted hover:text-fg transition-colors shrink-0"
                  title="Open deploy link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  onClick={() => startEdit(app)}
                  className="text-fg-muted hover:text-fg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(app.id)}
                  disabled={deletingId === app.id}
                  className="text-fg-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 disabled:opacity-30"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {iconPickerFor && (
        <IconPicker
          value={editForm.icon}
          onChange={(name) => setEditForm({ ...editForm, icon: name })}
          onClose={() => setIconPickerFor(null)}
        />
      )}
    </div>
  );
}
