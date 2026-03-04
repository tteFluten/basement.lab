"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getAppLabel } from "@/lib/appIcons";
import type { HistoryItem } from "@/lib/historyStore";
import Link from "next/link";
import { ArrowLeft, Loader2, ImageIcon } from "lucide-react";

function toItem(row: {
  id: string; appId: string; blobUrl?: string; thumbUrl?: string | null;
  width?: number | null; height?: number | null; name?: string | null;
  createdAt: number; tags?: string[]; projectId?: string | null;
  isPublic?: boolean;
}): HistoryItem {
  const created = row.createdAt != null ? new Date(row.createdAt).getTime() : Date.now();
  return {
    id: row.id,
    dataUrl: "",
    appId: row.appId,
    name: row.name ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    mimeType: "image/png",
    createdAt: Number.isFinite(created) ? created : Date.now(),
    blobUrl: row.blobUrl,
    thumbUrl: row.thumbUrl ?? undefined,
    projectId: row.projectId ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : undefined,
    isPublic: Boolean(row.isPublic),
  };
}

function ShareImage({ item }: { item: HistoryItem }) {
  const [src, setSrc] = useState(item.blobUrl || item.dataUrl || "");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleError = useCallback(() => {
    if (error || !src.includes("blob.vercel-storage.com")) return;
    setError(true);
    fetch(`/api/generations/resolve-url?url=${encodeURIComponent(src)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.url) {
          setSrc(j.url);
          setError(false);
        }
      })
      .catch(() => {});
  }, [src, error]);

  useEffect(() => {
    setSrc(item.blobUrl || item.dataUrl || "");
  }, [item.blobUrl, item.dataUrl]);

  if (!src) return null;
  return (
    <div className="relative aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-border">
      <img
        src={src}
        alt={item.name || item.id}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-xs truncate">
        {item.name || getAppLabel(item.appId)}
      </div>
    </div>
  );
}

export function ShareClient() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(!!ids.length);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ ids: ids.join(","), limit: "100", light: "1" });
    fetch(`/api/generations?${q}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, json: j })))
      .then(({ ok, json }) => {
        if (!ok) {
          setError(json?.error ?? "Error loading");
          setItems([]);
          return;
        }
        setItems((json.items ?? []).map(toItem));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Network error");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [idsParam]);

  return (
    <main className="min-h-screen bg-bg text-fg p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/history"
            className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to History
          </Link>
        </div>
        <h1 className="text-lg font-medium text-fg border-b border-border pb-4 mb-6">
          Shared gallery
        </h1>

        {ids.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-fg-muted">
            <ImageIcon className="w-12 h-12 mb-4 opacity-40" />
            <p className="text-sm">No images in this share link. Use a link with ?ids=...</p>
          </div>
        )}

        {loading && ids.length > 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-fg-muted">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="text-sm">Loading shared images…</p>
          </div>
        )}

        {error && (
          <div className="py-8 px-4 border border-amber-800/50 bg-amber-900/10 text-amber-200 text-sm rounded">
            {error}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((item) => (
              <ShareImage key={item.id} item={item} />
            ))}
          </div>
        )}

        {!loading && !error && ids.length > 0 && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-fg-muted">
            <ImageIcon className="w-12 h-12 mb-4 opacity-40" />
            <p className="text-sm">No images available. They may be private or removed.</p>
          </div>
        )}
      </div>
    </main>
  );
}
