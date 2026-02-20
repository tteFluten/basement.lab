"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { getHistory, type HistoryItem, SMALL_RESOLUTION_THRESHOLD } from "@/lib/historyStore";
import { getAppIcon, getAppLabel, getAppIds } from "@/lib/appIcons";
import {
  Download, Maximize2, ZoomIn, X, Trash2,
  LayoutGrid, LayoutList, Grid3X3, Layers, Calendar, FolderOpen, AppWindow,
} from "lucide-react";

/* ─── helpers ─── */

function toHistoryItem(row: {
  id: string; appId: string; dataUrl?: string | null; blobUrl?: string;
  width?: number | null; height?: number | null; name?: string | null;
  createdAt: number; tags?: string[];
}): HistoryItem {
  return {
    id: row.id, dataUrl: row.dataUrl || "", appId: row.appId,
    name: row.name ?? undefined, width: row.width ?? undefined,
    height: row.height ?? undefined, mimeType: "image/png",
    createdAt: row.createdAt,
    tags: Array.isArray(row.tags) ? row.tags : undefined,
    blobUrl: row.blobUrl,
  };
}

function imgUrl(item: HistoryItem) { return item.dataUrl || item.blobUrl || ""; }

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDay(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = today - day;
  if (diff === 0) return "Today";
  if (diff === 86400000) return "Yesterday";
  if (diff < 604800000) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function isSmallRes(item: HistoryItem) {
  const w = item.width ?? 0; const h = item.height ?? 0;
  return w > 0 && h > 0 && (w < SMALL_RESOLUTION_THRESHOLD || h < SMALL_RESOLUTION_THRESHOLD);
}

function isImg(item: HistoryItem) { return (item.mimeType || "image/png").startsWith("image/"); }

function extFromMime(v?: string) {
  if (!v) return "png";
  const map: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
    "image/svg+xml": "svg", "application/json": "json", "text/json": "json",
  };
  return map[v] ?? (v.startsWith("text/") ? "txt" : "bin");
}

function downloadItem(item: HistoryItem) {
  const u = imgUrl(item);
  if (!u) return;
  const a = document.createElement("a");
  a.href = u;
  a.download = item.fileName ?? `${item.name ?? item.id}.${extFromMime(item.mimeType)}`;
  a.click();
}

const APP_COLORS: Record<string, string> = {
  cineprompt: "#1a1215",
  chronos: "#111520",
  swag: "#111a14",
  avatar: "#15111a",
  render: "#1a1611",
  "frame-variator": "#111a1a",
};

function appBg(appId: string) { return APP_COLORS[appId] ?? "#151515"; }

type ViewMode = "large" | "small" | "list";
type GroupMode = "none" | "date" | "project" | "app";
type Project = { id: string; name: string };
type User = { id: string; email: string; full_name: string | null };

/* ─── image with colored placeholder ─── */

function LazyImg({ src: imgSrc, appId, className }: { src: string; appId: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full h-full" style={{ backgroundColor: appBg(appId) }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border border-zinc-700 flex items-center justify-center text-zinc-700">
            {(() => { const Icon = getAppIcon(appId); return <Icon className="w-3 h-3" />; })()}
          </div>
        </div>
      )}
      <img
        src={imgSrc}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
      />
    </div>
  );
}

/* ─── skeleton ─── */

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-800/60 ${className ?? ""}`} />;
}

function SkeletonGrid({ count, view }: { count: number; view: ViewMode }) {
  if (view === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center p-4 border border-border">
            <Skeleton className="w-20 h-20 shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  const gridCls = view === "large"
    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3";
  const h = view === "large" ? "h-56" : "h-40";
  return (
    <div className={gridCls}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border overflow-hidden">
          <Skeleton className={`w-full ${h}`} />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── card components ─── */

function LargeCard({
  item, deleting, onDelete, onView,
}: { item: HistoryItem; deleting: boolean; onDelete: () => void; onView: () => void }) {
  const Icon = getAppIcon(item.appId);
  const url = imgUrl(item);
  const image = isImg(item);
  return (
    <div className="border border-border overflow-hidden bg-bg-muted group hover:border-fg-muted transition-colors">
      <button type="button" onClick={() => image && url && onView()}
        className="w-full h-56 sm:h-64 relative block overflow-hidden focus:outline-none">
        {image && url ? (
          <>
            <LazyImg src={url} appId={item.appId} className="object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-0 flex items-center justify-center">
              <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: appBg(item.appId) }}>
            <span className="text-sm text-zinc-700 uppercase tracking-wider">{image ? "Loading…" : extFromMime(item.mimeType).toUpperCase()}</span>
          </div>
        )}
      </button>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 border border-border text-fg-muted shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-fg font-medium truncate">{item.name || getAppLabel(item.appId)}</p>
            <p className="text-xs text-fg-muted mt-0.5">{fmtDate(item.createdAt)}</p>
          </div>
        </div>
        {item.width && item.height && (
          <p className="text-xs text-fg-muted">{item.width} × {item.height}</p>
        )}
        {(item.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags!.slice(0, 4).map((t) => (
              <span key={t} className="text-[10px] bg-bg text-fg-muted px-2 py-0.5 border border-border">{t}</span>
            ))}
            {item.tags!.length > 4 && <span className="text-[10px] text-fg-muted">+{item.tags!.length - 4}</span>}
          </div>
        )}
      </div>
      <div className="flex border-t border-border">
        <button type="button" onClick={() => image && url && onView()} disabled={!image || !url}
          className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs text-fg-muted hover:bg-bg hover:text-fg transition-colors">
          <Maximize2 className="w-3.5 h-3.5" /> View
        </button>
        <button type="button" onClick={() => downloadItem(item)} disabled={!url}
          className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs text-fg-muted hover:bg-bg hover:text-fg transition-colors">
          <Download className="w-3.5 h-3.5" /> Download
        </button>
        {isSmallRes(item) && image && (
          <button type="button" onClick={() => { const a = document.createElement("a"); a.href = url; a.download = `${item.name ?? item.id}-4k.png`; a.click(); }}
            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs text-fg-muted hover:bg-bg hover:text-amber-400 transition-colors">
            <ZoomIn className="w-3.5 h-3.5" /> 4K
          </button>
        )}
        {!item.id.startsWith("h-") && (
          <button type="button" onClick={onDelete} disabled={deleting}
            className="py-2.5 px-4 flex items-center justify-center text-xs text-fg-muted hover:bg-red-900/20 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function SmallCard({
  item, deleting, onDelete, onView,
}: { item: HistoryItem; deleting: boolean; onDelete: () => void; onView: () => void }) {
  const Icon = getAppIcon(item.appId);
  const url = imgUrl(item);
  const image = isImg(item);
  return (
    <div className="border border-border overflow-hidden bg-bg-muted group hover:border-fg-muted transition-colors">
      <button type="button" onClick={() => image && url && onView()}
        className="w-full h-36 sm:h-44 relative block overflow-hidden focus:outline-none">
        {image && url ? (
          <>
            <LazyImg src={url} appId={item.appId} className="object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: appBg(item.appId) }}>
            <span className="text-xs text-zinc-700 uppercase">{extFromMime(item.mimeType).toUpperCase()}</span>
          </div>
        )}
      </button>
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-fg-muted shrink-0" />
          <span className="text-xs text-fg truncate">{getAppLabel(item.appId)}</span>
        </div>
        <p className="text-[10px] text-fg-muted">{fmtDate(item.createdAt)}</p>
      </div>
      <div className="flex border-t border-border">
        <button type="button" onClick={() => image && url && onView()} disabled={!image || !url}
          className="flex-1 py-2 flex items-center justify-center text-xs text-fg-muted hover:text-fg transition-colors">
          <Maximize2 className="w-3 h-3" />
        </button>
        <button type="button" onClick={() => downloadItem(item)} disabled={!url}
          className="flex-1 py-2 flex items-center justify-center text-xs text-fg-muted hover:text-fg transition-colors">
          <Download className="w-3 h-3" />
        </button>
        {!item.id.startsWith("h-") && (
          <button type="button" onClick={onDelete} disabled={deleting}
            className="py-2 px-2 flex items-center justify-center text-xs text-fg-muted hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function ListRow({
  item, deleting, onDelete, onView,
}: { item: HistoryItem; deleting: boolean; onDelete: () => void; onView: () => void }) {
  const Icon = getAppIcon(item.appId);
  const url = imgUrl(item);
  const image = isImg(item);
  return (
    <div className="flex items-center gap-4 px-4 py-3 border border-border bg-bg-muted hover:border-fg-muted transition-colors group">
      <button type="button" onClick={() => image && url && onView()}
        className="w-20 h-20 shrink-0 overflow-hidden relative focus:outline-none">
        {image && url ? (
          <>
            <LazyImg src={url} appId={item.appId} className="object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: appBg(item.appId) }}>
            <span className="text-xs text-zinc-700 uppercase">{extFromMime(item.mimeType).toUpperCase()}</span>
          </div>
        )}
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-fg-muted shrink-0" />
          <span className="text-sm text-fg font-medium truncate">{item.name || getAppLabel(item.appId)}</span>
        </div>
        <p className="text-xs text-fg-muted">{fmtDate(item.createdAt)}{item.width && item.height ? ` · ${item.width}×${item.height}` : ""}</p>
        {(item.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags!.slice(0, 5).map((t) => (
              <span key={t} className="text-[10px] bg-bg text-fg-muted px-1.5 py-0.5 border border-border">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => image && url && onView()} disabled={!image || !url}
          className="p-2 text-fg-muted hover:text-fg transition-colors hover:bg-bg" title="View">
          <Maximize2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => downloadItem(item)} disabled={!url}
          className="p-2 text-fg-muted hover:text-fg transition-colors hover:bg-bg" title="Download">
          <Download className="w-4 h-4" />
        </button>
        {!item.id.startsWith("h-") && (
          <button type="button" onClick={onDelete} disabled={deleting}
            className="p-2 text-fg-muted hover:text-red-400 transition-colors hover:bg-red-900/20" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── group helpers ─── */

function groupItems(items: HistoryItem[], mode: GroupMode, projects: Project[]): { label: string; items: HistoryItem[] }[] {
  if (mode === "none") return [{ label: "", items }];
  const map = new Map<string, HistoryItem[]>();
  const order: string[] = [];
  for (const item of items) {
    let key: string;
    if (mode === "date") key = fmtDay(item.createdAt);
    else if (mode === "project") {
      const proj = projects.find((p) => p.id === (item as HistoryItem & { projectId?: string }).projectId);
      key = proj?.name ?? "No project";
    } else key = getAppLabel(item.appId);
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(item);
  }
  return order.map((label) => ({ label, items: map.get(label)! }));
}

/* ─── render items ─── */

function RenderItems({
  items, view, deletingId, onDelete, onView, indexOffset,
}: {
  items: HistoryItem[]; view: ViewMode; deletingId: string | null;
  onDelete: (id: string) => void; onView: (item: HistoryItem) => void;
  indexOffset: number;
}) {
  if (view === "list") {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <ListRow key={item.id} item={item} deleting={deletingId === item.id}
            onDelete={() => onDelete(item.id)} onView={() => onView(item)} />
        ))}
      </div>
    );
  }
  const gridCls = view === "large"
    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3";
  const Card = view === "large" ? LargeCard : SmallCard;
  return (
    <div className={gridCls}>
      {items.map((item) => (
        <Card key={item.id} item={item} deleting={deletingId === item.id}
          onDelete={() => onDelete(item.id)} onView={() => onView(item)} />
      ))}
    </div>
  );
}

/* ─── toolbar button ─── */

function ToolBtn({
  active, onClick, children, title,
}: { active: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`p-2 transition-colors ${active ? "bg-bg text-fg" : "text-fg-muted hover:text-fg hover:bg-bg"}`}>
      {children}
    </button>
  );
}

/* ─── main ─── */

export function HistoryClient() {
  const [apiItems, setApiItems] = useState<HistoryItem[]>([]);
  const [memoryItems, setMemoryItems] = useState<HistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [lightboxItem, setLightboxItem] = useState<HistoryItem | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterAppId, setFilterAppId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("large");
  const [group, setGroup] = useState<GroupMode>("none");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "100");
    if (filterProjectId) p.set("projectId", filterProjectId);
    if (filterUserId) p.set("userId", filterUserId);
    if (filterTag.trim()) p.set("tag", filterTag.trim());
    if (filterAppId) p.set("appId", filterAppId);
    return p.toString();
  }, [filterProjectId, filterUserId, filterTag, filterAppId]);

  const fetchApi = useCallback(async () => {
    setApiError(null);
    setApiLoading(true);
    try {
      const res = await fetch(`/api/generations?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setApiError(json.error ?? `Error ${res.status}`); setApiItems([]); return; }
      setApiItems((json.items ?? []).map(toHistoryItem));
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Network error");
      setApiItems([]);
    } finally { setApiLoading(false); }
  }, [qs]);

  useEffect(() => { fetchApi(); }, [fetchApi]);
  useEffect(() => { fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(Array.isArray(d?.items) ? d.items : [])).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/users").then((r) => r.json()).then((d) => { if (Array.isArray(d?.items)) { setUsers(d.items); setIsAdmin(true); } }).catch(() => {}); }, []);
  useEffect(() => {
    setMemoryItems(getHistory());
    const iv = setInterval(() => setMemoryItems(getHistory()), 3000);
    return () => clearInterval(iv);
  }, []);

  const items = useMemo(() => {
    const combined = [...apiItems];
    const seen = new Set(apiItems.map((i) => i.id));
    for (const m of memoryItems) { if (!seen.has(m.id)) { seen.add(m.id); combined.push(m); } }
    combined.sort((a, b) => b.createdAt - a.createdAt);
    return combined;
  }, [apiItems, memoryItems]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((i) =>
      i.appId.toLowerCase().includes(q) ||
      (i.name ?? "").toLowerCase().includes(q) ||
      (i.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }, [items, search]);

  const groups = useMemo(() => groupItems(filtered, group, projects), [filtered, group, projects]);

  const handleDelete = useCallback(async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try { const res = await fetch(`/api/generations/${id}`, { method: "DELETE" }); if (res.ok) fetchApi(); }
    finally { setDeletingId(null); }
  }, [deletingId, fetchApi]);

  const lbSrc = lightboxItem ? imgUrl(lightboxItem) : "";

  return (
    <main className="p-8 lg:p-10 bg-bg min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-5 mb-6">
        <div>
          <h1 className="text-lg font-medium text-fg tracking-wide">History</h1>
          <p className="text-xs text-fg-muted mt-1">
            {items.length} generation{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-0.5 bg-bg-muted border border-border p-0.5">
          <ToolBtn active={view === "large"} onClick={() => setView("large")} title="Large cards">
            <LayoutGrid className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn active={view === "small"} onClick={() => setView("small")} title="Small cards">
            <Grid3X3 className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn active={view === "list"} onClick={() => setView("list")} title="List">
            <LayoutList className="w-4 h-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolBtn active={group === "none"} onClick={() => setGroup("none")} title="No grouping">
            <Layers className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn active={group === "date"} onClick={() => setGroup("date")} title="Group by date">
            <Calendar className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn active={group === "project"} onClick={() => setGroup("project")} title="Group by project">
            <FolderOpen className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn active={group === "app"} onClick={() => setGroup("app")} title="Group by app">
            <AppWindow className="w-4 h-4" />
          </ToolBtn>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search by name, app, tags..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-sm bg-bg-muted border border-border px-4 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted transition-colors" />
        <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)}
          className="bg-bg-muted border border-border px-3 py-2.5 text-sm text-fg">
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {isAdmin && (
          <select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}
            className="bg-bg-muted border border-border px-3 py-2.5 text-sm text-fg">
            <option value="">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
        )}
        <select value={filterAppId} onChange={(e) => setFilterAppId(e.target.value)}
          className="bg-bg-muted border border-border px-3 py-2.5 text-sm text-fg">
          <option value="">All apps</option>
          {getAppIds().map((id) => <option key={id} value={id}>{getAppLabel(id)}</option>)}
        </select>
        <input type="text" placeholder="Tag" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
          className="w-28 bg-bg-muted border border-border px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted" />
        {apiError && (
          <button type="button" onClick={fetchApi}
            className="px-4 py-2.5 border border-amber-600 text-amber-400 text-sm hover:bg-amber-600/20 transition-colors">
            Retry
          </button>
        )}
      </div>

      {/* Content */}
      {apiLoading && apiItems.length === 0 ? (
        <SkeletonGrid count={view === "list" ? 5 : view === "large" ? 8 : 12} view={view} />
      ) : apiError && apiItems.length === 0 ? (
        <p className="text-amber-400/90 text-sm">{apiError}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-fg-muted">
          <Layers className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-sm">{items.length === 0 ? "No generations yet." : "No items match your filters."}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g, gi) => {
            const offset = groups.slice(0, gi).reduce((acc, prev) => acc + prev.items.length, 0);
            return (
              <div key={g.label || "__all"}>
                {g.label && (
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-sm font-medium text-fg uppercase tracking-wider">{g.label}</h2>
                    <span className="text-xs text-fg-muted border border-border px-2 py-0.5">{g.items.length}</span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                )}
                <RenderItems items={g.items} view={view} deletingId={deletingId}
                  onDelete={handleDelete} onView={setLightboxItem} indexOffset={offset} />
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setLightboxItem(null)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setLightboxItem(null)}
            className="absolute top-5 right-5 p-2.5 text-fg-muted hover:text-fg border border-border hover:border-fg-muted transition-colors"
            aria-label="Close">
            <X className="w-5 h-5" />
          </button>
          <div className="relative max-w-[95vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {lbSrc ? (
              <img src={lbSrc} alt="" className="max-w-full max-h-[85vh] object-contain border border-border" />
            ) : (
              <div className="text-fg-muted text-base">No image</div>
            )}
          </div>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-3 bg-bg/95 border border-border">
            <span className="text-xs text-fg-muted">
              {getAppLabel(lightboxItem.appId)} · {fmtDate(lightboxItem.createdAt)}
            </span>
            <button type="button" onClick={() => downloadItem(lightboxItem)}
              className="py-2 px-5 bg-fg text-bg text-xs font-bold uppercase hover:bg-white transition-colors">
              Download
            </button>
            {isSmallRes(lightboxItem) && (
              <button type="button"
                onClick={() => { const a = document.createElement("a"); a.href = lbSrc; a.download = `${lightboxItem.name ?? lightboxItem.id}-4k.png`; a.click(); }}
                className="py-2 px-5 border border-border text-fg-muted text-xs font-bold uppercase hover:border-amber-500 hover:text-amber-400 transition-colors">
                Upscale 4K
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
