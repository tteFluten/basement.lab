"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { getHistory, type HistoryItem, SMALL_RESOLUTION_THRESHOLD } from "@/lib/historyStore";
import { getAppIcon, getAppLabel, getAppIds } from "@/lib/appIcons";
import { Download, Maximize2, ZoomIn, X, Trash2 } from "lucide-react";

function toHistoryItem(row: {
  id: string;
  appId: string;
  dataUrl?: string | null;
  blobUrl?: string;
  width?: number | null;
  height?: number | null;
  name?: string | null;
  createdAt: number;
  tags?: string[];
}): HistoryItem {
  return {
    id: row.id,
    dataUrl: row.dataUrl || "",
    appId: row.appId,
    name: row.name ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    mimeType: "image/png",
    createdAt: row.createdAt,
    tags: Array.isArray(row.tags) ? row.tags : undefined,
    blobUrl: row.blobUrl,
  };
}

function imgSrc(item: HistoryItem): string {
  return item.dataUrl || item.blobUrl || "";
}

function extFromMime(v?: string) {
  if (!v) return "png";
  if (v === "image/png") return "png";
  if (v === "image/jpeg") return "jpg";
  if (v === "image/webp") return "webp";
  if (v === "image/svg+xml") return "svg";
  if (v === "application/json" || v === "text/json") return "json";
  if (v.startsWith("text/")) return "txt";
  return "bin";
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSmall(item: HistoryItem) {
  const w = item.width ?? 0;
  const h = item.height ?? 0;
  return w > 0 && h > 0 && (w < SMALL_RESOLUTION_THRESHOLD || h < SMALL_RESOLUTION_THRESHOLD);
}

function isImg(item: HistoryItem) {
  return (item.mimeType || "image/png").startsWith("image/");
}

type Project = { id: string; name: string };
type User = { id: string; email: string; full_name: string | null };

function HistoryCard({
  item,
  deleting,
  onDelete,
  onView,
}: {
  item: HistoryItem;
  deleting: boolean;
  onDelete: () => void;
  onView: () => void;
}) {
  const Icon = getAppIcon(item.appId);
  const src = imgSrc(item);
  const image = isImg(item);
  const small = isSmall(item);

  const download = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = item.fileName ?? `${item.name ?? item.id}.${extFromMime(item.mimeType)}`;
    a.click();
  };

  return (
    <div className="border border-[#333] overflow-hidden bg-[#111] group">
      <button
        type="button"
        onClick={() => image && src && onView()}
        className="w-full h-20 sm:h-24 relative block overflow-hidden focus:outline-none"
      >
        {image && src ? (
          <>
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
            <span className="text-[8px] text-zinc-600 uppercase">{image ? "…" : extFromMime(item.mimeType).toUpperCase()}</span>
          </div>
        )}
      </button>

      <div className="px-1.5 py-1 border-t border-[#333] space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="flex items-center justify-center w-4 h-4 border border-[#333] text-zinc-500 shrink-0">
            <Icon className="w-2.5 h-2.5" />
          </span>
          <span className="text-[7px] text-zinc-500 uppercase truncate">{getAppLabel(item.appId)}</span>
        </div>
        <p className="text-[7px] text-zinc-600">{fmtDate(item.createdAt)}</p>
        {(item.tags?.length ?? 0) > 0 && (
          <p className="text-[6px] text-zinc-600 truncate" title={item.tags!.join(", ")}>
            {item.tags!.slice(0, 3).join(", ")}
            {item.tags!.length > 3 ? "…" : ""}
          </p>
        )}
      </div>

      <div className="flex border-t border-[#333]">
        <button
          type="button"
          onClick={() => image && src && onView()}
          disabled={!image || !src}
          className="flex-1 py-1 flex items-center justify-center gap-0.5 text-[7px] text-zinc-500 hover:bg-[#1a1a1a] hover:text-zinc-300 transition-colors"
        >
          <Maximize2 className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          onClick={download}
          disabled={!src}
          className="flex-1 py-1 flex items-center justify-center gap-0.5 text-[7px] text-zinc-500 hover:bg-[#1a1a1a] hover:text-zinc-300 transition-colors"
        >
          <Download className="w-2.5 h-2.5" />
        </button>
        {small && image && (
          <button
            type="button"
            onClick={() => {
              if (!src) return;
              const a = document.createElement("a");
              a.href = src;
              a.download = `${item.name ?? item.id}-4k.png`;
              a.click();
            }}
            className="flex-1 py-1 flex items-center justify-center gap-0.5 text-[7px] text-zinc-500 hover:bg-[#1a1a1a] hover:text-amber-400 transition-colors"
          >
            <ZoomIn className="w-2.5 h-2.5" />
          </button>
        )}
        {!item.id.startsWith("h-") && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="py-1 px-1.5 flex items-center justify-center text-[7px] text-zinc-500 hover:bg-red-900/30 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

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
  const [filterMinW, setFilterMinW] = useState("");
  const [filterMaxW, setFilterMaxW] = useState("");
  const [filterMinH, setFilterMinH] = useState("");
  const [filterMaxH, setFilterMaxH] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "50");
    if (filterProjectId) p.set("projectId", filterProjectId);
    if (filterUserId) p.set("userId", filterUserId);
    if (filterTag.trim()) p.set("tag", filterTag.trim());
    if (filterAppId) p.set("appId", filterAppId);
    if (filterMinW.trim()) p.set("minWidth", filterMinW.trim());
    if (filterMaxW.trim()) p.set("maxWidth", filterMaxW.trim());
    if (filterMinH.trim()) p.set("minHeight", filterMinH.trim());
    if (filterMaxH.trim()) p.set("maxHeight", filterMaxH.trim());
    return p.toString();
  }, [filterProjectId, filterUserId, filterTag, filterAppId, filterMinW, filterMaxW, filterMinH, filterMaxH]);

  const fetchApi = useCallback(async () => {
    setApiError(null);
    setApiLoading(true);
    try {
      const res = await fetch(`/api/generations?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApiError(json.error ?? `Error ${res.status}`);
        setApiItems([]);
        return;
      }
      setApiItems((json.items ?? []).map(toHistoryItem));
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Network error");
      setApiItems([]);
    } finally {
      setApiLoading(false);
    }
  }, [qs]);

  useEffect(() => { fetchApi(); }, [fetchApi]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(Array.isArray(d?.items) ? d.items : [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d) => {
      if (Array.isArray(d?.items)) { setUsers(d.items); setIsAdmin(true); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setMemoryItems(getHistory());
    const iv = setInterval(() => setMemoryItems(getHistory()), 3000);
    return () => clearInterval(iv);
  }, []);

  const items = useMemo(() => {
    const combined = [...apiItems];
    const seen = new Set(apiItems.map((i) => i.id));
    for (const m of memoryItems) {
      if (!seen.has(m.id)) { seen.add(m.id); combined.push(m); }
    }
    combined.sort((a, b) => b.createdAt - a.createdAt);
    return combined;
  }, [apiItems, memoryItems]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        i.appId.toLowerCase().includes(q) ||
        (i.name ?? "").toLowerCase().includes(q) ||
        (i.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }, [items, search]);

  const handleDelete = useCallback(async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/generations/${id}`, { method: "DELETE" });
      if (res.ok) fetchApi();
    } finally { setDeletingId(null); }
  }, [deletingId, fetchApi]);

  const lbSrc = lightboxItem ? imgSrc(lightboxItem) : "";

  return (
    <main className="p-6 bg-[#0a0a0a] min-h-full">
      <h1 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] border-b border-[#333] pb-2 mb-3">
        History
      </h1>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by app, name, tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] max-w-sm bg-[#111] border border-[#333] px-3 py-1.5 text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        {apiError && (
          <button type="button" onClick={fetchApi} className="px-3 py-1.5 border border-amber-600 text-amber-400 text-[9px] uppercase hover:bg-amber-600/20 transition-colors">
            Retry
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[9px]">
        <span className="text-zinc-500 uppercase">Filters:</span>
        <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)} className="bg-[#111] border border-[#333] px-2 py-1 text-zinc-300">
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {isAdmin && (
          <select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} className="bg-[#111] border border-[#333] px-2 py-1 text-zinc-300">
            <option value="">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
        )}
        <select value={filterAppId} onChange={(e) => setFilterAppId(e.target.value)} className="bg-[#111] border border-[#333] px-2 py-1 text-zinc-300">
          <option value="">All apps</option>
          {getAppIds().map((id) => <option key={id} value={id}>{getAppLabel(id)}</option>)}
        </select>
        <input type="text" placeholder="Tag" value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="w-20 bg-[#111] border border-[#333] px-2 py-1 text-zinc-300 placeholder:text-zinc-600" />
        <input type="number" placeholder="Min W" value={filterMinW} onChange={(e) => setFilterMinW(e.target.value)} className="w-14 bg-[#111] border border-[#333] px-1.5 py-1 text-zinc-300 placeholder:text-zinc-600" />
        <input type="number" placeholder="Max W" value={filterMaxW} onChange={(e) => setFilterMaxW(e.target.value)} className="w-14 bg-[#111] border border-[#333] px-1.5 py-1 text-zinc-300 placeholder:text-zinc-600" />
        <input type="number" placeholder="Min H" value={filterMinH} onChange={(e) => setFilterMinH(e.target.value)} className="w-14 bg-[#111] border border-[#333] px-1.5 py-1 text-zinc-300 placeholder:text-zinc-600" />
        <input type="number" placeholder="Max H" value={filterMaxH} onChange={(e) => setFilterMaxH(e.target.value)} className="w-14 bg-[#111] border border-[#333] px-1.5 py-1 text-zinc-300 placeholder:text-zinc-600" />
      </div>

      {apiLoading && apiItems.length === 0 ? (
        <p className="text-zinc-500 text-[10px]">Loading…</p>
      ) : apiError && apiItems.length === 0 ? (
        <p className="text-amber-400/90 text-[10px] mb-2">{apiError}</p>
      ) : null}

      {filtered.length === 0 && !apiLoading ? (
        <p className="text-zinc-600 text-[10px]">
          {items.length === 0 ? "No items yet." : "No items match."}
        </p>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {filtered.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              deleting={deletingId === item.id}
              onDelete={() => handleDelete(item.id)}
              onView={() => setLightboxItem(item)}
            />
          ))}
        </div>
      ) : null}

      {lightboxItem && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightboxItem(null)}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white border border-[#333] hover:border-zinc-500 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-[95vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {lbSrc ? (
              <img src={lbSrc} alt="" className="max-w-full max-h-[90vh] object-contain border border-[#333]" />
            ) : (
              <div className="text-zinc-500 text-sm">No image</div>
            )}
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-[#111]/90 border border-[#333]">
            <span className="text-[9px] text-zinc-500 uppercase">
              {getAppLabel(lightboxItem.appId)} · {fmtDate(lightboxItem.createdAt)}
            </span>
            <button
              type="button"
              onClick={() => {
                if (!lbSrc) return;
                const a = document.createElement("a");
                a.href = lbSrc;
                a.download = lightboxItem.fileName ?? `${lightboxItem.name ?? lightboxItem.id}.png`;
                a.click();
              }}
              className="py-2 px-4 bg-zinc-100 text-black text-[9px] font-bold uppercase hover:bg-white transition-colors"
            >
              Download
            </button>
            {isSmall(lightboxItem) && (
              <button
                type="button"
                onClick={() => {
                  if (!lbSrc) return;
                  const a = document.createElement("a");
                  a.href = lbSrc;
                  a.download = `${lightboxItem.name ?? lightboxItem.id}-4k.png`;
                  a.click();
                }}
                className="py-2 px-4 border border-[#333] text-zinc-400 text-[9px] font-bold uppercase hover:border-amber-500 hover:text-amber-400 transition-colors"
              >
                Upscale to 4K
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
