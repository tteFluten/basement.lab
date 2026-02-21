"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search, X, ExternalLink, Pencil, Image as ImageIcon,
  ArrowRight, ChevronLeft, Plus,
} from "lucide-react";
import { AddSubmittedAppModal } from "@/components/AddSubmittedAppModal";
import { getTemplateIcon } from "@/lib/iconTemplate";

type SubmittedApp = {
  id: string;
  userId: string | null;
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
};

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function parseItems(json: { items?: unknown[] }): SubmittedApp[] {
  const raw = (json?.items ?? []) as Record<string, unknown>[];
  return raw.map((row) => ({
    id: String(row.id ?? ""),
    userId: row.userId != null ? String(row.userId) : null,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    deployLink: String(row.deployLink ?? ""),
    editLink: row.editLink != null ? String(row.editLink) : null,
    thumbnailUrl: row.thumbnailUrl != null ? String(row.thumbnailUrl) : null,
    icon: row.icon != null ? String(row.icon) : null,
    version: String(row.version ?? "1.0"),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    createdAt: typeof row.createdAt === "number" ? row.createdAt : new Date(String(row.createdAt)).getTime(),
    submittedBy: row.submittedBy != null ? String(row.submittedBy) : null,
  }));
}

export default function SubmittedAppsPage() {
  const [items, setItems] = useState<SubmittedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterSubmitter, setFilterSubmitter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/submitted-apps?limit=500");
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

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const allSubmitters = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.submittedBy) set.add(i.submittedBy);
    });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.submittedBy ?? "").toLowerCase().includes(q) ||
          i.version.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filterTag) {
      list = list.filter((i) => i.tags.some((t) => t === filterTag));
    }
    if (filterSubmitter) {
      list = list.filter((i) => i.submittedBy === filterSubmitter);
    }
    return list;
  }, [items, search, filterTag, filterSubmitter]);

  return (
    <>
      <main className="p-8 lg:p-10 bg-bg min-h-full text-fg">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-5 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/" className="text-fg-muted hover:text-fg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-lg font-medium text-fg tracking-wide">Submitted Applications</h1>
            </div>
            <p className="text-xs text-fg-muted mt-1">{items.length} application{items.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-fg text-bg hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add app
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] max-w-sm flex items-center gap-2 bg-bg-muted border border-border px-3 py-2.5">
            <Search className="w-3.5 h-3.5 text-fg-muted shrink-0" />
            <input
              type="text"
              placeholder="Search by title, description, tags, submitter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-fg-muted hover:text-fg p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="bg-bg-muted border border-border px-3 py-2.5 text-sm text-fg"
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filterSubmitter}
            onChange={(e) => setFilterSubmitter(e.target.value)}
            className="bg-bg-muted border border-border px-3 py-2.5 text-sm text-fg"
          >
            <option value="">All submitters</option>
            {allSubmitters.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-fg-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-fg-muted">
            <ImageIcon className="w-12 h-12 opacity-20" />
            <p className="text-sm">
              {items.length === 0
                ? "No submitted applications yet."
                : "No applications match your filters."}
            </p>
          </div>
        ) : (
          <ul className="border border-border divide-y divide-border">
            {filtered.map((app) => (
              <li key={app.id} className="flex items-center gap-4 p-4 hover:bg-bg-muted/30 transition-colors">
                <AppThumbnail thumbnailUrl={app.thumbnailUrl} icon={app.icon} className="w-14 h-14 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/submitted-apps/${app.id}`} className="text-sm font-medium text-fg hover:underline">{app.title}</Link>
                    <span className="text-xs text-fg-muted">v{app.version}</span>
                    {app.tags.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {app.tags.map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 bg-bg-muted border border-border text-fg-muted">
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  {app.description && (
                    <p className="text-xs text-fg-muted mt-0.5 line-clamp-2">{app.description}</p>
                  )}
                  <p className="text-[10px] text-fg-muted mt-1 flex items-center gap-1.5">
                    {app.submittedBy && <span className="text-fg text-[11px] font-medium">{app.submittedBy}</span>}
                    {app.submittedBy && <span className="text-fg-muted">·</span>}
                    <span>{fmtDate(app.createdAt)}</span>
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
      </main>
      <AddSubmittedAppModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => setRefreshTrigger((t) => t + 1)}
      />
    </>
  );
}
