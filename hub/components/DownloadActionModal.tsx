"use client";

import { addToHistory, removeFromHistory } from "@/lib/historyStore";
import { getCurrentProjectId } from "@/lib/currentProject";
import { addToCachedGenerations } from "@/lib/generationsCache";
import { generateThumbnail } from "@/lib/thumbnail";

type Props = {
  open: boolean;
  onClose: () => void;
  assetDataUrl: string | null;
  appId: string;
  mimeType?: string;
  fileName?: string;
  /** Prompt used to generate (saved to history when adding) */
  prompt?: string;
  onDone: () => void;
};

export function DownloadActionModal({
  open,
  onClose,
  assetDataUrl,
  appId,
  mimeType,
  fileName,
  prompt,
  onDone,
}: Props) {
  if (!open || !assetDataUrl) return null;

  const inferredMimeType =
    mimeType ||
    (assetDataUrl.startsWith("data:")
      ? assetDataUrl.slice(5).split(";")[0] || undefined
      : undefined);
  const isImageAsset = (inferredMimeType || "").startsWith("image/");

  const extensionFromMime = (value?: string) => {
    if (!value) return "bin";
    if (value === "image/png") return "png";
    if (value === "image/jpeg") return "jpg";
    if (value === "image/webp") return "webp";
    if (value === "image/svg+xml") return "svg";
    if (value === "application/json" || value === "text/json") return "json";
    if (value.startsWith("text/")) return "txt";
    return "bin";
  };

  const computedFileName =
    fileName || `basement-${appId}-${Date.now()}.${extensionFromMime(inferredMimeType)}`;

  const handleDownloadOnly = () => {
    const link = document.createElement("a");
    link.href = assetDataUrl;
    link.download = computedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onDone();
    onClose();
  };

  const triggerDownload = () => {
    const link = document.createElement("a");
    link.href = assetDataUrl;
    link.download = computedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onDone();
    onClose();
  };

  const handleDownloadAndSave = () => {
    const name = `${appId}-${Date.now()}`;
    if (!isImageAsset) {
      addToHistory({
        dataUrl: assetDataUrl,
        appId,
        name,
        fileName: computedFileName,
        mimeType: inferredMimeType,
      });
      triggerDownload();
      return;
    }

    const img = new Image();
    img.onload = async () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      const thumbDataUrl = await generateThumbnail(assetDataUrl).catch(() => "");

      const memItem = addToHistory({
        dataUrl: assetDataUrl,
        appId,
        name,
        fileName: computedFileName,
        mimeType: inferredMimeType,
        width,
        height,
        thumbUrl: thumbDataUrl || undefined,
        ...(prompt?.trim() ? { prompt: prompt.trim() } : {}),
      });
      triggerDownload();
      const projectId = getCurrentProjectId();
      fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl: assetDataUrl,
          thumbDataUrl: thumbDataUrl || undefined,
          appId,
          name,
          width,
          height,
          ...(projectId ? { projectId } : {}),
          ...(prompt?.trim() ? { prompt: prompt.trim() } : {}),
        }),
      })
        .then(async (r) => {
          if (!r.ok) return;
          const json = await r.json().catch(() => ({}));
          removeFromHistory(memItem.id);
          addToCachedGenerations({
            id: json.id ?? memItem.id,
            appId,
            dataUrl: assetDataUrl,
            blobUrl: json.blob_url ?? undefined,
            thumbUrl: json.thumb_url ?? thumbDataUrl ?? null,
            width,
            height,
            name,
            createdAt: json.created_at ? new Date(json.created_at).getTime() : Date.now(),
            tags: Array.isArray(json.tags) ? json.tags : [],
            projectId: projectId ?? null,
            userId: null,
            prompt: prompt?.trim() || null,
            note: null,
          });
        })
        .catch(() => {});
    };
    img.onerror = () => {
      addToHistory({
        dataUrl: assetDataUrl,
        appId,
        name,
        fileName: computedFileName,
        mimeType: inferredMimeType,
      });
      triggerDownload();
    };
    img.src = assetDataUrl;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
      <div className="bg-[#111] border border-[#333] max-w-sm w-full mx-4 p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em]">
          Download
        </h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleDownloadOnly}
            className="w-full py-4 bg-zinc-100 text-black text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-colors"
          >
            Download only
          </button>
          <button
            type="button"
            onClick={handleDownloadAndSave}
            className="w-full py-4 border border-[#333] text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            Download and add to history
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-[9px] text-zinc-600 uppercase tracking-widest hover:text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
