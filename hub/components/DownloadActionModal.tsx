"use client";

import { addToHistory } from "@/lib/historyStore";

type Props = {
  open: boolean;
  onClose: () => void;
  imageDataUrl: string | null;
  appId: string;
  onDone: () => void;
};

export function DownloadActionModal({
  open,
  onClose,
  imageDataUrl,
  appId,
  onDone,
}: Props) {
  if (!open || !imageDataUrl) return null;

  const handleDownloadOnly = () => {
    const link = document.createElement("a");
    link.href = imageDataUrl;
    link.download = `basement-${appId}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onDone();
    onClose();
  };

  const handleDownloadAndSave = () => {
    addToHistory({ dataUrl: imageDataUrl, appId, name: `${appId}-${Date.now()}` });
    const link = document.createElement("a");
    link.href = imageDataUrl;
    link.download = `basement-${appId}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onDone();
    onClose();
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
