"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Search, ExternalLink, Pencil, X, Image as ImageIcon } from "lucide-react";

export type SubmittedAppItem = {
  id: string;
  userId: string | null;
  title: string;
  description: string;
  deployLink: string;
  editLink: string | null;
  thumbnailUrl: string | null;
  version: string;
  tags: string[];
  createdAt: number;
  submittedBy: string | null;
};

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseItems(json: { items?: unknown[] }): SubmittedAppItem[] {
  const raw = json?.items ?? [];
  return raw.map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ""),
    userId: row.userId != null ? String(row.userId) : null,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    deployLink: String(row.deployLink ?? ""),
    editLink: row.editLink != null ? String(row.editLink) : null,
    thumbnailUrl: row.thumbnailUrl != null ? String(row.thumbnailUrl) : null,
    version: String(row.version ?? "1.0"),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    createdAt: typeof row.createdAt === "number" ? row.createdAt : new Date(String(row.createdAt)).getTime(),
    submittedBy: row.submittedBy != null ? String(row.submittedBy) : null,
  }));
}

type Props = {
  onAddClick: () => void;
  refreshTrigger?: number;
};

export function SubmittedAppsSection({ onAddClick, refreshTrigger = 0 }: Props) {
  const [items, setItems] = useState<SubmittedAppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/submitted-apps");
      const json = await res.json().catch(() => ({}));
      setItems(parseItems(json));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshTrigger]);

  const filtered = useMemo(() => {
    let list = items;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.submittedBy ?? "").toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filterTag.trim()) {
      const tag = filterTag.trim().toLowerCase();
      list = list.filter((i) => i.tags.some((t) => t.toLowerCase() === tag || t.toLowerCase().includes(tag)));
    }
    return list;
  }, [items, search, filterTag]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  return (
    <section className="mb-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left mb-4 group"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-fg-muted group-hover:text-fg" />
        ) : (
          <ChevronRight className="w-4 h-4 text-fg-muted group-hover:text-fg" />
        )}
        <h2 className="text-xs font-bold text-fg-muted uppercase tracking-[0.2em] group-hover:text-fg transition-colors">
          Submitted applications
        </h2>
        <span className="text-xs text-fg-muted">({items.length})</span>
      </button>

      {open && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex-1 min-w-[200px] max-w-sm flex items-center gap-2 bg-bg-muted border border-border px-3 py-2">
              <Search className="w-3.5 h-3.5 text-fg-muted shrink-0" />
              <input
                type="text"
                placeholder="Search by title, description, tags, submitter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-fg-muted hover:text-fg p-0.5" aria-label="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="bg-bg-muted border border-border px-3 py-2 text-sm text-fg"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-fg-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 border border-border bg-bg-muted/30 flex flex-col items-center justify-center gap-3 text-fg-muted">
              <ImageIcon className="w-10 h-10 opacity-40" />
              <p className="text-sm">
                {items.length === 0
                  ? "No submitted applications yet. Add one with the + button below."
                  : "No applications match your search."}
              </p>
              {items.length === 0 && (
                <button type="button" onClick={onAddClick} className="text-xs text-fg hover:underline">
                  Add application
                </button>
              )}
            </div>
          ) : (
            <ul className="border border-border divide-y divide-border">
              {filtered.map((app) => (
                <li key={app.id} className="flex items-center gap-4 p-3 hover:bg-bg-muted/30 transition-colors">
                  <div className="w-12 h-12 shrink-0 bg-bg-muted border border-border flex items-center justify-center overflow-hidden">
                    {app.thumbnailUrl ? (
                      <img src={app.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-fg-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-fg">{app.title}</span>
                      <span className="text-xs text-fg-muted">v{app.version}</span>
                      {app.tags.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {app.tags.slice(0, 5).map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 bg-bg-muted border border-border text-fg-muted">
                              {t}
                            </span>
                          ))}
                          {app.tags.length > 5 && (
                            <span className="text-[10px] text-fg-muted">+{app.tags.length - 5}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {app.description && (
                      <p className="text-xs text-fg-muted mt-0.5 line-clamp-1">{app.description}</p>
                    )}
                    <p className="text-[10px] text-fg-muted mt-1">
                      {fmtDate(app.createdAt)}
                      {app.submittedBy && ` · ${app.submittedBy}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={app.deployLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-fg-muted hover:text-fg border border-transparent hover:border-border transition-colors"
                      title="Open deploy"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {app.editLink && (
                      <a
                        href={app.editLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-fg-muted hover:text-fg border border-transparent hover:border-border transition-colors"
                        title="Open edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
