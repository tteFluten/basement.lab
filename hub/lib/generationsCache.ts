"use client";

/**
 * Global client-side cache for API generations.
 * Shared across all components — fetches once, returns instantly after.
 * Uses light endpoint to skip user lookups for speed.
 */

export interface CachedGeneration {
  id: string;
  appId: string;
  dataUrl?: string | null;
  blobUrl?: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  name?: string | null;
  createdAt: number;
  tags?: string[];
  projectId?: string | null;
  userId?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
  projectName?: string | null;
}

type Listener = () => void;

let cachedItems: CachedGeneration[] = [];
let lastFetchTime = 0;
let fetchPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

const STALE_MS = 60_000;

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeGenerations(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getCachedGenerations(): CachedGeneration[] {
  return cachedItems;
}

export function isCacheReady(): boolean {
  return lastFetchTime > 0;
}

function parseRow(row: Record<string, unknown>): CachedGeneration {
  return {
    id: String(row.id ?? ""),
    appId: String(row.appId ?? row.app_id ?? ""),
    dataUrl: row.dataUrl != null ? String(row.dataUrl) : (row.data_url != null ? String(row.data_url) : null),
    blobUrl: row.blobUrl != null ? String(row.blobUrl) : (row.blob_url != null ? String(row.blob_url) : undefined),
    thumbUrl: row.thumbUrl != null ? String(row.thumbUrl) : (row.thumb_url != null ? String(row.thumb_url) : null),
    width: typeof row.width === "number" ? row.width : null,
    height: typeof row.height === "number" ? row.height : null,
    name: row.name != null ? String(row.name) : null,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    projectId: row.projectId != null ? String(row.projectId) : null,
    userId: row.userId != null ? String(row.userId) : null,
    userName: row.userName != null ? String(row.userName) : null,
    userAvatarUrl: row.userAvatarUrl != null ? String(row.userAvatarUrl) : null,
    projectName: row.projectName != null ? String(row.projectName) : null,
  };
}

async function doFetch(limit = 200): Promise<void> {
  try {
    const res = await fetch(`/api/generations?limit=${limit}&light=1`);
    if (!res.ok) return;
    const json = await res.json();
    if (Array.isArray(json?.items)) {
      cachedItems = json.items.map((r: Record<string, unknown>) => parseRow(r));
      lastFetchTime = Date.now();
      notify();
    }
  } catch {
    /* network error — keep stale cache */
  }
}

/**
 * Returns cached items immediately if fresh. Otherwise fetches.
 * Multiple concurrent callers share one in-flight request.
 */
export async function fetchGenerations(force = false): Promise<CachedGeneration[]> {
  const isStale = Date.now() - lastFetchTime > STALE_MS;

  if (!force && !isStale && lastFetchTime > 0) {
    return cachedItems;
  }

  if (!force && lastFetchTime > 0) {
    doFetch();
    return cachedItems;
  }

  if (!fetchPromise) {
    fetchPromise = doFetch().finally(() => { fetchPromise = null; });
  }
  await fetchPromise;
  return cachedItems;
}

export function invalidateGenerationsCache(): void {
  lastFetchTime = 0;
}

export function addToCachedGenerations(item: CachedGeneration): void {
  cachedItems = [item, ...cachedItems.filter((g) => g.id !== item.id)];
  notify();
}

export function removeFromCachedGenerations(id: string): void {
  cachedItems = cachedItems.filter((g) => g.id !== id);
  notify();
}
