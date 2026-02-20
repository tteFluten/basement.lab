"use client";

import { useRef } from "react";
import { getHistory, type HistoryItem } from "@/lib/historyStore";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (dataUrl: string) => void;
};

export function ReferencePickerModal({ open, onClose, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const history = open ? getHistory() : [];

  if (!open) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      onSelect(dataUrl);
      onClose();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleHistoryPick = (item: HistoryItem) => {
    onSelect(item.dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
      <div className="bg-[#111] border border-[#333] max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[#333] px-4 py-3">
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em]">
            Reference
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm"
          >
            Close
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">
              Upload file
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full py-4 border border-[#333] text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>
          {history.length > 0 && (
            <div>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">
                From history
              </p>
              <div className="grid grid-cols-4 gap-2">
                {history.slice(0, 12).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleHistoryPick(item)}
                    className="aspect-square border border-[#333] overflow-hidden hover:border-zinc-500 transition-colors bg-black"
                  >
                    <img
                      src={item.dataUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
