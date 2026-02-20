"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { getHistory, type HistoryItem } from "@/lib/historyStore";
import { getAppIcon, getAppLabel, getAppIds } from "@/lib/appIcons";
import { Upload, Clock, Search, X, Check } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (dataUrl: string) => void;
};

type Tab = "upload" | "history";

const APP_BG: Record<string, string> = {
  cineprompt: "#1a1215", chronos: "#111520", swag: "#111a14",
  avatar: "#15111a", render: "#1a1611", "frame-variator": "#111a1a",
};

function LazyThumb({ src: s, appId }: { src: string; appId: string }) {
  const [loaded, setLoaded] = useState(false);
  const Icon = getAppIcon(appId);
  return (
    <div className="relative w-full h-full" style={{ backgroundColor: APP_BG[appId] ?? "#151515" }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-4 h-4 text-zinc-600 animate-pulse" />
        </div>
      )}
      <img src={s} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}

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

export function ReferencePickerModal({ open, onClose, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [filterApp, setFilterApp] = useState("");
  const [apiItems, setApiItems] = useState<HistoryItem[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const memoryItems = open ? getHistory() : [];

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setFilterApp("");
    setSelectedId(null);
    setTab("upload");

    setApiLoading(true);
    fetch("/api/generations?limit=50")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.items)) setApiItems(d.items.map(toHistoryItem));
      })
      .catch(() => {})
      .finally(() => setApiLoading(false));
  }, [open]);

  const allItems = useMemo(() => {
    const combined = [...apiItems];
    const seen = new Set(apiItems.map((i) => i.id));
    for (const m of memoryItems) {
      if (!seen.has(m.id)) { seen.add(m.id); combined.push(m); }
    }
    combined.sort((a, b) => b.createdAt - a.createdAt);
    return combined;
  }, [apiItems, memoryItems]);

  const filtered = useMemo(() => {
    let list = allItems;
    if (filterApp) list = list.filter((i) => i.appId === filterApp);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) =>
        i.appId.toLowerCase().includes(q) ||
        (i.name ?? "").toLowerCase().includes(q) ||
        (i.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allItems, filterApp, search]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      onSelect(reader.result as string);
      onClose();
    };
    reader.readAsDataURL(file);
  }, [onSelect, onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  const handleHistoryPick = (item: HistoryItem) => {
    const url = item.dataUrl || item.blobUrl || "";
    if (!url) return;

    if (url.startsWith("data:") || url.startsWith("blob:")) {
      onSelect(url);
      onClose();
      return;
    }

    setSelectedId(item.id);
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          onSelect(reader.result as string);
          onClose();
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        onSelect(url);
        onClose();
      });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-bg border border-border max-w-xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
          <h2 className="text-xs font-bold text-fg-muted uppercase tracking-[0.2em]">
            Select Image
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-fg-muted hover:text-fg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          <button type="button" onClick={() => setTab("upload")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-colors ${
              tab === "upload" ? "text-fg border-b-2 border-fg" : "text-fg-muted hover:text-fg"
            }`}>
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
          <button type="button" onClick={() => setTab("history")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-colors ${
              tab === "history" ? "text-fg border-b-2 border-fg" : "text-fg-muted hover:text-fg"
            }`}>
            <Clock className="w-3.5 h-3.5" /> History
            {allItems.length > 0 && (
              <span className="text-[10px] text-fg-muted border border-border px-1.5 py-0">{allItems.length}</span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === "upload" ? (
            <div className="p-5">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed cursor-pointer transition-colors py-16 flex flex-col items-center justify-center gap-3 ${
                  dragOver ? "border-fg-muted bg-bg-muted" : "border-border hover:border-fg-muted"
                }`}
              >
                <Upload className="w-8 h-8 text-fg-muted" />
                <p className="text-sm text-fg-muted">
                  Drop an image here or <span className="text-fg underline">browse</span>
                </p>
                <p className="text-[10px] text-fg-muted">PNG, JPG, WEBP</p>
              </div>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
            </div>
          ) : (
            <div>
              {/* Search + filter */}
              <div className="px-4 pt-3 pb-2 flex gap-2 sticky top-0 bg-bg z-10 border-b border-border">
                <div className="flex-1 flex items-center gap-2 border border-border bg-bg-muted px-3 py-1.5">
                  <Search className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="flex-1 bg-transparent text-xs text-fg placeholder:text-fg-muted focus:outline-none" />
                  {search && (
                    <button type="button" onClick={() => setSearch("")} className="text-fg-muted hover:text-fg">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <select value={filterApp} onChange={(e) => setFilterApp(e.target.value)}
                  className="bg-bg-muted border border-border px-2 py-1.5 text-xs text-fg">
                  <option value="">All apps</option>
                  {getAppIds().map((id) => <option key={id} value={id}>{getAppLabel(id)}</option>)}
                </select>
              </div>

              {/* Grid */}
              {apiLoading && allItems.length === 0 ? (
                <div className="p-4 grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-zinc-800/60 animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs text-fg-muted">{allItems.length === 0 ? "No history items yet." : "No items match."}</p>
                </div>
              ) : (
                <div className="p-3 grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {filtered.map((item) => {
                    const url = item.dataUrl || item.blobUrl || "";
                    const Icon = getAppIcon(item.appId);
                    const isSelected = selectedId === item.id;
                    if (!url) return null;
                    return (
                      <button key={item.id} type="button" onClick={() => handleHistoryPick(item)}
                        className={`relative aspect-square border overflow-hidden transition-colors group ${
                          isSelected ? "border-fg" : "border-border hover:border-fg-muted"
                        }`}>
                        <LazyThumb src={url} appId={item.appId} />
                        {isSelected && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white flex items-center justify-center animate-pulse">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Icon className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                          <span className="text-[8px] text-zinc-400 truncate">{getAppLabel(item.appId)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
