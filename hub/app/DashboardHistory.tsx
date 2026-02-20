"use client";

import { useEffect, useState } from "react";
import { getHistory, type HistoryItem } from "@/lib/historyStore";
import { getAppIcon, getAppLabel } from "@/lib/appIcons";
import Link from "next/link";

const APP_COLORS: Record<string, string> = {
  cineprompt: "#1a1215",
  chronos: "#111520",
  swag: "#111a14",
  avatar: "#15111a",
  render: "#1a1611",
  "frame-variator": "#111a1a",
};

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

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function DashboardCard({ item }: { item: HistoryItem }) {
  const Icon = getAppIcon(item.appId);
  const url = item.dataUrl || item.blobUrl || "";
  const [loaded, setLoaded] = useState(false);

  return (
    <Link href="/history" className="block border border-border overflow-hidden bg-bg-muted hover:border-fg-muted transition-colors group">
      <div className="h-36 sm:h-44 relative overflow-hidden" style={{ backgroundColor: APP_COLORS[item.appId] ?? "#151515" }}>
        {url ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border border-zinc-700 flex items-center justify-center text-zinc-700">
                  <Icon className="w-3 h-3" />
                </div>
              </div>
            )}
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={`w-full h-full object-cover transition-all duration-300 ${loaded ? "opacity-100" : "opacity-0"} group-hover:scale-105`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-6 h-6 text-zinc-700" />
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 space-y-0.5">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-fg-muted shrink-0" />
          <span className="text-xs text-fg truncate">{item.name || getAppLabel(item.appId)}</span>
        </div>
        <p className="text-[10px] text-fg-muted">{fmtDate(item.createdAt)}</p>
      </div>
    </Link>
  );
}

export function DashboardHistory() {
  const [apiItems, setApiItems] = useState<HistoryItem[]>([]);
  const [memoryItems, setMemoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/generations?limit=8")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.items)) setApiItems(d.items.map(toHistoryItem));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setMemoryItems(getHistory());
    const iv = setInterval(() => setMemoryItems(getHistory()), 3000);
    return () => clearInterval(iv);
  }, []);

  const items = (() => {
    const combined = [...apiItems];
    const seen = new Set(apiItems.map((i) => i.id));
    for (const m of memoryItems) { if (!seen.has(m.id)) { seen.add(m.id); combined.push(m); } }
    combined.sort((a, b) => b.createdAt - a.createdAt);
    return combined.slice(0, 8);
  })();

  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border overflow-hidden">
            <div className="h-36 sm:h-44 animate-pulse bg-zinc-800/60" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-20 animate-pulse bg-zinc-800/60" />
              <div className="h-2 w-14 animate-pulse bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-border p-8 text-center">
        <p className="text-sm text-fg-muted">No generations yet. Use an app and save to history.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <DashboardCard key={item.id} item={item} />
      ))}
    </div>
  );
}
