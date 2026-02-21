"use client";

import { useEffect, useState, useMemo } from "react";
import { getHistory, type HistoryItem } from "@/lib/historyStore";
import { getAppLabel } from "@/lib/appIcons";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { Spinner } from "@/components/Spinner";

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

function downloadUrl(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function GalleryImage({ item }: { item: HistoryItem }) {
  const url = item.dataUrl || item.blobUrl || "";
  const [loaded, setLoaded] = useState(false);
  const label = item.name || getAppLabel(item.appId);

  if (!url) return null;

  return (
    <Link
      href="/history"
      className="block relative overflow-hidden group"
    >
      <img
        src={url}
        alt={label}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-auto block transition-all duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end justify-between p-3 opacity-0 group-hover:opacity-100">
        <span className="text-[10px] text-white/80 font-medium tracking-wider uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadUrl(url, label); }}
          className="flex items-center justify-center w-7 h-7 bg-white/90 hover:bg-white text-black transition-colors shrink-0"
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </Link>
  );
}

export function DashboardHistory() {
  const [apiItems, setApiItems] = useState<HistoryItem[]>([]);
  const [memoryItems, setMemoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/generations?limit=12")
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

  const items = useMemo(() => {
    const combined = [...apiItems];
    const seen = new Set(apiItems.map((i) => i.id));
    for (const m of memoryItems) {
      if (!seen.has(m.id)) { seen.add(m.id); combined.push(m); }
    }
    combined.sort((a, b) => b.createdAt - a.createdAt);
    return combined.slice(0, 12).filter((i) => i.dataUrl || i.blobUrl);
  }, [apiItems, memoryItems]);

  if (loading && items.length === 0) {
    return <Spinner size={28} steps={["Loading gallery", "Fetching latest work", "Building collage", "Almost there"]} />;
  }

  if (items.length === 0) {
    return (
      <div className="border border-border p-12 text-center">
        <p className="text-sm text-fg-muted">No generations yet. Use an app and save to history.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="columns-2 sm:columns-3 md:columns-4 gap-1.5">
        {items.map((item) => (
          <div key={item.id} className="mb-1.5 break-inside-avoid">
            <GalleryImage item={item} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <Link
          href="/history"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-xs text-fg-muted hover:text-fg hover:border-fg-muted transition-colors uppercase tracking-widest"
        >
          View full gallery <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
