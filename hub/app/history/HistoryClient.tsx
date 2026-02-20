"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { getHistory, type HistoryItem, SMALL_RESOLUTION_THRESHOLD } from "@/lib/historyStore";
import { getAppIcon, getAppLabel, getAppIds } from "@/lib/appIcons";
import { Download, Maximize2, ZoomIn, X, Trash2 } from "lucide-react";

function apiItemToHistoryItem(row: {
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
  const dataUrl = row.dataUrl && row.dataUrl.length > 0 ? row.dataUrl : "";
  return {
    id: row.id,
    dataUrl,
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

type Project = { id: string; name: string };
type User = { id: string; email: string; full_name: string | null };

type HistoryCardProps = {
  item: HistoryItem;
  onRequestResolve: (id: string, blobUrl: string) => void;
  displayUrl: string;
  isSmall: boolean;
  isImage: boolean;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onView: () => void;
  onDownload: () => void;
  onUpscale4K: () => void;
  formatDate: (ts: number) => string;
  extensionFromMime: (mime?: string) => string;
};

function HistoryCard({
  item,
  onRequestResolve,
  displayUrl,
  isSmall,
  isImage,
  deletingId,
  onDelete,
  onView,
  onDownload,
  onUpscale4K,
  formatDate,
  extensionFromMime,
}: HistoryCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const requested = useRef(false);
  useEffect(() => {
    if (!item.blobUrl || displayUrl || requested.current) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (requested.current) return;
        requested.current = true;
        onRequestResolve(item.id, item.blobUrl!);
      },
      { rootMargin: "100px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [item.id, item.blobUrl, displayUrl, onRequestResolve]);

  const Icon = getAppIcon(item.appId);
  return (
    <div ref={ref} className="border border-[#333] overflow-hidden bg-[#111] group">
      <button
        type="button"
        onClick={() => isImage && onView()}
        className="w-full h-20 sm:h-24 flex-shrink-0 relative block overflow-hidden focus:outline-none focus:ring-2 focus:ring-zinc-500"
      >
        {isImage ? (
          displayUrl ? (
            <>
              <img
                src={displayUrl}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
              <span className="text-[9px] text-zinc-600 uppercase">Loading…</span>
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-500 bg-[#0f0f0f]">
            <span className="text-[8px] uppercase tracking-widest">File</span>
            <span className="text-[10px]">{extensionFromMime(item.mimeType).toUpperCase()}</span>
          </div>
        )}
      </button>
      <div className="p-1.5 border-t border-[#333] space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center justify-center w-4 h-4 border border-[#333] text-zinc-500 flex-shrink-0">
            <Icon className="w-2.5 h-2.5" />
          </span>
          <span className="text-[8px] text-zinc-500 uppercase truncate flex-1 min-w-0">
            {getAppLabel(item.appId)}
          </span>
        </div>
        <p className="text-[7px] text-zinc-600">{formatDate(item.createdAt)}</p>
        {(item.tags?.length ?? 0) > 0 && (
          <p className="text-[6px] text-zinc-600 truncate" title={item.tags!.join(", ")}>
            {item.tags!.slice(0, 3).join(", ")}
            {item.tags!.length > 3 ? "…" : ""}
          </p>
        )}
      </div>
      <div className="flex border-t border-[#333] flex-wrap">
        <button
          type="button"
          onClick={() => isImage && onView()}
          className="flex-1 py-1.5 flex items-center justify-center gap-0.5 text-[7px] text-zinc-500 hover:bg-[#1a1a1a] hover:text-zinc-300 transition-colors"
          title={isImage ? "View large" : "Preview not available"}
          disabled={!isImage}
        >
          <Maximize2 className="w-2.5 h-2.5" />
          View
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex-1 py-1.5 flex items-center justify-center gap-0.5 text-[7px] text-zinc-500 hover:bg-[#1a1a1a] hover:text-zinc-300 transition-colors"
          title="Download"
        >
          <Download className="w-2.5 h-2.5" />
          Download
        </button>
        {isSmall && isImage && (
          <button
            type="button"
            onClick={onUpscale4K}
            className="flex-1 py-1.5 flex items-center justify-center gap-0.5 text-[7px] text-zinc-500 hover:bg-[#1a1a1a] hover:text-amber-400 transition-colors"
            title="Download as 4K (upscale)"
          >
            <ZoomIn className="w-2.5 h-2.5" />
            4K
          </button>
        )}
        {!item.id.startsWith("h-") && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            disabled={deletingId === item.id}
            className="py-1.5 px-1.5 flex items-center justify-center text-[7px] text-zinc-500 hover:bg-red-900/30 hover:text-red-400 transition-colors"
            title="Delete"
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
  const [filterMinWidth, setFilterMinWidth] = useState("");
  const [filterMaxWidth, setFilterMaxWidth] = useState("");
  const [filterMinHeight, setFilterMinHeight] = useState("");
  const [filterMaxHeight, setFilterMaxHeight] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (filterProjectId) params.set("projectId", filterProjectId);
    if (filterUserId) params.set("userId", filterUserId);
    if (filterTag.trim()) params.set("tag", filterTag.trim());
    if (filterAppId) params.set("appId", filterAppId);
    if (filterMinWidth.trim()) params.set("minWidth", filterMinWidth.trim());
    if (filterMaxWidth.trim()) params.set("maxWidth", filterMaxWidth.trim());
    if (filterMinHeight.trim()) params.set("minHeight", filterMinHeight.trim());
    if (filterMaxHeight.trim()) params.set("maxHeight", filterMaxHeight.trim());
    return params.toString();
  }, [
    filterProjectId,
    filterUserId,
    filterTag,
    filterAppId,
    filterMinWidth,
    filterMaxWidth,
    filterMinHeight,
    filterMaxHeight,
  ]);

  const fetchApiHistory = useCallback(async () => {
    setApiError(null);
    setApiLoading(true);
    try {
      const res = await fetch(`/api/generations?${queryString}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApiError(json.error ?? `Error ${res.status}. Check Supabase and Blob setup.`);
        setApiItems([]);
        return;
      }
      const list = (json.items ?? []).map(apiItemToHistoryItem);
      setApiItems(list);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Network error. Check Hub env (Supabase).");
      setApiItems([]);
    } finally {
      setApiLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchApiHistory();
  }, [fetchApiHistory]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data?.items) ? data.items : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.items)) {
          setUsers(data.items);
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMemoryItems(getHistory());
    const interval = setInterval(() => setMemoryItems(getHistory()), 2000);
    return () => clearInterval(interval);
  }, []);

  const items = useMemo(() => {
    const combined = [...apiItems];
    const seen = new Set(apiItems.map((i) => i.id));
    for (const m of memoryItems) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        combined.push(m);
      }
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
        (i.userName ?? "").toLowerCase().includes(q) ||
        (i.projectName ?? "").toLowerCase().includes(q) ||
        (i.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }, [items, search]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (deletingId) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/generations/${id}`, { method: "DELETE" });
        if (res.ok) fetchApiHistory();
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId, fetchApiHistory]
  );

  const getDisplayUrl = useCallback(
    (item: HistoryItem): string => {
      if (item.dataUrl) return item.dataUrl;
      return resolvedUrls[item.id] ?? "";
    },
    [resolvedUrls]
  );

  const requestResolveUrl = useCallback((id: string, blobUrl: string) => {
    if (!blobUrl) return;
    const params = new URLSearchParams({ url: blobUrl });
    fetch(`/api/blob-url?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.url) setResolvedUrls((prev) => ({ ...prev, [id]: data.url }));
      })
      .catch(() => {});
  }, []);

  const handleDownload = (item: HistoryItem) => {
    const url = getDisplayUrl(item);
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = item.fileName ?? `${item.name ?? item.id}.${extensionFromMime(item.mimeType)}`;
    link.click();
  };

  const handleUpscale4K = (item: HistoryItem) => {
    const url = getDisplayUrl(item);
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.name ?? item.id}-4k.png`;
    link.click();
  };

  const isSmallResolution = (item: HistoryItem) => {
    const w = item.width ?? 0;
    const h = item.height ?? 0;
    return w > 0 && h > 0 && (w < SMALL_RESOLUTION_THRESHOLD || h < SMALL_RESOLUTION_THRESHOLD);
  };

  const isImageItem = (item: HistoryItem) => (item.mimeType || "image/png").startsWith("image/");

  function extensionFromMime(value?: string) {
    if (!value) return "png";
    if (value === "image/png") return "png";
    if (value === "image/jpeg") return "jpg";
    if (value === "image/webp") return "webp";
    if (value === "image/svg+xml") return "svg";
    if (value === "application/json" || value === "text/json") return "json";
    if (value.startsWith("text/")) return "txt";
    return "bin";
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <main className="p-8 bg-[#0a0a0a] min-h-full">
      <h1 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] border-b border-[#333] pb-2 mb-4">
        History
      </h1>
      <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-4">
        Images saved via &quot;Download and add to history&quot;. View large, download, or request 4K upscale (when resolution is small).
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search by app, name, user, project, tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md bg-[#111] border border-[#333] px-4 py-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        {apiError && (
          <button
            type="button"
            onClick={() => fetchApiHistory()}
            className="px-4 py-2 border border-amber-600 text-amber-400 text-[10px] uppercase hover:bg-amber-600/20 transition-colors"
          >
            Retry
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-[10px]">
        <span className="text-zinc-500 uppercase">Filters:</span>
        <select
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
          className="bg-[#111] border border-[#333] px-2 py-1.5 text-zinc-300"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="bg-[#111] border border-[#333] px-2 py-1.5 text-zinc-300"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </select>
        )}
        <select
          value={filterAppId}
          onChange={(e) => setFilterAppId(e.target.value)}
          className="bg-[#111] border border-[#333] px-2 py-1.5 text-zinc-300"
        >
          <option value="">All apps</option>
          {getAppIds().map((appId) => (
            <option key={appId} value={appId}>
              {getAppLabel(appId)}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Tag"
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="w-24 bg-[#111] border border-[#333] px-2 py-1.5 text-zinc-300 placeholder:text-zinc-600"
        />
        <input
          type="number"
          placeholder="Min W"
          value={filterMinWidth}
          onChange={(e) => setFilterMinWidth(e.target.value)}
          className="w-16 bg-[#111] border border-[#333] px-2 py-1.5 text-zinc-300 placeholder:text-zinc-600"
        />
        <input
          type="number"
          placeholder="Max W"
          value={filterMaxWidth}
          onChange={(e) => setFilterMaxWidth(e.target.value)}
          className="w-16 bg-[#111] border border-[#333] px-2 py-1.5 text-zinc-300 placeholder:text-zinc-600"
        />
        <input
          type="number"
          placeholder="Min H"
          value={filterMinHeight}
          onChange={(e) => setFilterMinHeight(e.target.value)}
          className="w-16 bg-[#111] border border-[#333] px-2 py-1.5 text-zinc-300 placeholder:text-zinc-600"
        />
        <input
          type="number"
          placeholder="Max H"
          value={filterMaxHeight}
          onChange={(e) => setFilterMaxHeight(e.target.value)}
          className="w-16 bg-[#111] border border-[#333] px-2 py-1.5 text-zinc-300 placeholder:text-zinc-600"
        />
      </div>

      {apiLoading && apiItems.length === 0 ? (
        <p className="text-zinc-500 text-[10px]">Loading history...</p>
      ) : apiError && apiItems.length === 0 ? (
        <p className="text-amber-400/90 text-[10px] mb-2">{apiError}</p>
      ) : null}

      {filtered.length === 0 && !apiLoading ? (
        <p className="text-zinc-600 text-[10px]">
          {items.length === 0 ? "No items yet. Use &quot;Download and add to history&quot; in an app." : "No items match the search."}
        </p>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-3">
          {filtered.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              onRequestResolve={requestResolveUrl}
              displayUrl={getDisplayUrl(item)}
              isSmall={isSmallResolution(item)}
              isImage={isImageItem(item)}
              deletingId={deletingId}
              onDelete={handleDelete}
              onView={() => {
                setLightboxItem(item);
                if (item.blobUrl && !getDisplayUrl(item)) requestResolveUrl(item.id, item.blobUrl);
              }}
              onDownload={() => handleDownload(item)}
              onUpscale4K={() => handleUpscale4K(item)}
              formatDate={formatDate}
              extensionFromMime={extensionFromMime}
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
          aria-label="View image"
        >
          <button
            type="button"
            onClick={() => setLightboxItem(null)}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white border border-[#333] hover:border-zinc-500 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {getDisplayUrl(lightboxItem) ? (
              <img
                src={getDisplayUrl(lightboxItem)}
                alt=""
                className="max-w-full max-h-[90vh] object-contain border border-[#333]"
              />
            ) : (
              <div className="text-zinc-500 text-sm">Loading image…</div>
            )}
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-[#111]/90 border border-[#333]">
            <span className="text-[9px] text-zinc-500 uppercase">
              {getAppLabel(lightboxItem.appId)} · {formatDate(lightboxItem.createdAt)}
            </span>
            <button
              type="button"
              onClick={() => handleDownload(lightboxItem)}
              className="py-2 px-4 bg-zinc-100 text-black text-[9px] font-bold uppercase hover:bg-white transition-colors"
            >
              Download
            </button>
            {isSmallResolution(lightboxItem) && (
              <button
                type="button"
                onClick={() => handleUpscale4K(lightboxItem)}
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
