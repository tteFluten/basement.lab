"use client";

import { useCallback } from "react";
import { useGenerations } from "@/lib/useGenerations";
import { uploadFeedbackImage } from "@/lib/uploadFeedbackImage";
import { X, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
};

export function FeedbackHistoryImagePicker({ open, onClose, onSelect }: Props) {
  const { items, loading } = useGenerations(50);

  const handlePick = useCallback(
    async (item: { blobUrl?: string; dataUrl?: string | null; id: string }) => {
      const url = item.blobUrl ?? item.dataUrl;
      if (!url) return;

      if (url.startsWith("http")) {
        onSelect(url);
        onClose();
        return;
      }

      if (url.startsWith("data:image/")) {
        const uploaded = await uploadFeedbackImage(url, `gen-${item.id}.png`);
        if (uploaded) {
          onSelect(uploaded);
          onClose();
        }
      }
    },
    [onSelect, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="bg-bg border border-border max-w-xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
          <h2 className="text-xs font-bold text-fg-muted uppercase tracking-[0.2em]">Pick from history</h2>
          <button type="button" onClick={onClose} className="p-1 text-fg-muted hover:text-fg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-fg-muted" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-fg-muted font-mono py-8 text-center">No images in history yet.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {items.map((item) => {
                const src = item.thumbUrl ?? item.blobUrl ?? item.dataUrl ?? "";
                if (!src) return null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePick(item)}
                    className="aspect-square rounded border border-border overflow-hidden bg-bg-muted hover:border-fg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-fg-muted"
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
