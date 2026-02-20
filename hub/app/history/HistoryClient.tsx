"use client";

import { useEffect, useState } from "react";
import { getHistory, type HistoryItem } from "@/lib/historyStore";

export function HistoryClient() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setItems(getHistory());
    const interval = setInterval(() => setItems(getHistory()), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="p-8 bg-[#111] min-h-full">
      <h1 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] border-b border-[#333] pb-2 mb-6">
        History
      </h1>
      <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-6">
        Images saved via &quot;Download and add to history&quot;. Pick from here when using &quot;Upload or pick from history&quot; in any app.
      </p>
      {items.length === 0 ? (
        <p className="text-zinc-600 text-[10px]">No items yet.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-[#333] overflow-hidden bg-[#181818]"
            >
              <img
                src={item.dataUrl}
                alt=""
                className="w-full aspect-square object-cover"
              />
              <div className="p-2 border-t border-[#333]">
                <p className="text-[8px] text-zinc-500 uppercase truncate">
                  {item.appId}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
