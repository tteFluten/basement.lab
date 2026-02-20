/**
 * Per-user history (in-memory for session; later keyed by userId after login).
 * Images kept in memory so they can be passed between apps. No localStorage for payload (quota).
 */
export interface HistoryItem {
  id: string;
  dataUrl: string;
  appId: string;
  createdAt: number;
  name?: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  userName?: string;
  projectName?: string;
  /** Descriptive tags for search (from API) */
  tags?: string[];
}

const MAX_ITEMS = 30;
let memory: HistoryItem[] = [];

export function getHistory(): HistoryItem[] {
  return [...memory];
}

export function addToHistory(
  item: Omit<HistoryItem, "id" | "createdAt">
): HistoryItem {
  const newItem: HistoryItem = {
    ...item,
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  };
  memory.unshift(newItem);
  memory = memory.slice(0, MAX_ITEMS);
  return newItem;
}

/** Threshold below which we show "Upscale to 4K" option (e.g. 1920) */
export const SMALL_RESOLUTION_THRESHOLD = 1920;

export function removeFromHistory(id: string): void {
  memory = memory.filter((i) => i.id !== id);
}
