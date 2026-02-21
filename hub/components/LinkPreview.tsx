"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  url: string;
}

const cache = new Map<string, OgData | null>();

function useLinkPreview(url: string | undefined) {
  const [data, setData] = useState<OgData | null>(url ? cache.get(url) ?? null : null);
  const [loading, setLoading] = useState(!!(url && !cache.has(url)));

  useEffect(() => {
    if (!url) return;
    if (cache.has(url)) {
      setData(cache.get(url) ?? null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/og-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: OgData | null) => {
        cache.set(url, d);
        setData(d);
      })
      .catch(() => { cache.set(url, null); setData(null); })
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading };
}

export function LinkPreview({ url, label }: { url: string; label?: string }) {
  const { data, loading } = useLinkPreview(url);
  const [imgFailed, setImgFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  let hostname = "";
  try { hostname = new URL(url).hostname; } catch { /* ignore */ }

  if (loading) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-3 border border-border p-3 hover:border-fg-muted transition-colors group">
        <div className="w-16 h-12 bg-bg-muted animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3 w-24 bg-bg-muted animate-pulse" />
          <div className="h-2.5 w-40 bg-bg-muted animate-pulse" />
        </div>
      </a>
    );
  }

  const title = data?.title || label || hostname;
  const desc = data?.description;
  const image = data?.image && !imgFailed ? data.image : null;
  const favicon = data?.favicon && !faviconFailed ? data.favicon : null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 border border-border p-2.5 hover:border-fg-muted transition-colors group overflow-hidden">
      {image ? (
        <div className="w-16 h-12 shrink-0 overflow-hidden bg-bg-muted border border-border">
          <img src={image} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        </div>
      ) : (
        <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-bg-muted border border-border">
          {favicon ? (
            <img src={favicon} alt="" className="w-5 h-5" onError={() => setFaviconFailed(true)} />
          ) : (
            <Globe className="w-4 h-4 text-fg-muted" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-fg truncate group-hover:underline">{title}</p>
        {desc && <p className="text-[10px] text-fg-muted truncate mt-0.5">{desc}</p>}
        <p className="text-[10px] text-fg-muted mt-0.5 flex items-center gap-1">
          {favicon && image && !faviconFailed && (
            <img src={favicon} alt="" className="w-3 h-3 inline" onError={() => setFaviconFailed(true)} />
          )}
          {hostname}
        </p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </a>
  );
}
