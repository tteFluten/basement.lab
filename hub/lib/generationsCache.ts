"use client";

/**
 * Global client-side cache for API generations.
 * Persists lightweight metadata to localStorage for instant cold starts.
 * Shows stale cache immediately, then refreshes in background.
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
  prompt?: string | null;
  note?: string | null;
  isPublic?: boolean;
}

type Listener = () => void;

const LS_KEY = "bl_gen_cache";
const LS_TS_KEY = "bl_gen_cache_ts";
const STALE_MS = 120_000;
const PHASE1_LIMIT = 20;
const FAST_LIMIT = 50;
const FULL_LIMIT = 150;

let cachedItems: CachedGeneration[] = [];
let lastFetchTime = 0;
let fetchPromise: Promise<void> | null = null;
let _isRefreshing = false;
const listeners = new Set<Listener>();
const refreshListeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function notifyRefresh() {
  refreshListeners.forEach((fn) => fn());
}

function persistToStorage() {
  try {
    const slim = cachedItems.map((g) => ({
      id: g.id, a: g.appId, b: g.blobUrl ?? null, t: g.thumbUrl ?? null,
      w: g.width ?? null, h: g.height ?? null, n: g.name ?? null,
      c: g.createdAt, tg: g.tags?.length ? g.tags : undefined,
      p: g.projectId ?? null, u: g.userId ?? null,
      pub: g.isPublic ?? null,
    }));
    localStorage.setItem(LS_KEY, JSON.stringify(slim));
    localStorage.setItem(LS_TS_KEY, String(lastFetchTime));
  } catch { /* quota exceeded or unavailable */ }
}

function hydrateFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const ts = Number(localStorage.getItem(LS_TS_KEY) || 0);
    if (!raw || !ts) return false;
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    cachedItems = parsed.map((r) => ({
      id: String(r.id ?? ""),
      appId: String(r.a ?? ""),
      blobUrl: r.b != null ? String(r.b) : undefined,
      thumbUrl: r.t != null ? String(r.t) : null,
      width: typeof r.w === "number" ? r.w : null,
      height: typeof r.h === "number" ? r.h : null,
      name: r.n != null ? String(r.n) : null,
      createdAt: typeof r.c === "number" ? r.c : 0,
      tags: Array.isArray(r.tg) ? r.tg.map(String) : [],
      projectId: r.p != null ? String(r.p) : null,
      userId: r.u != null ? String(r.u) : null,
      isPublic: r.pub === true,
      dataUrl: null,
      userName: null,
      userAvatarUrl: null,
      projectName: null,
    }));
    lastFetchTime = ts;
    return true;
  } catch { return false; }
}

if (typeof window !== "undefined") {
  hydrateFromStorage();
}

export function subscribeGenerations(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Subscribe to refresh state changes (isRefreshing toggling). */
export function subscribeRefreshing(fn: Listener): () => void {
  refreshListeners.add(fn);
  return () => { refreshListeners.delete(fn); };
}

export function getCachedGenerations(): CachedGeneration[] {
  return cachedItems;
}

export function isCacheReady(): boolean {
  return lastFetchTime > 0;
}

/** Whether a background refresh is currently in progress. */
export function isRefreshing(): boolean {
  return _isRefreshing;
}

/** Timestamp of the last successful fetch. */
export function getLastFetchTime(): number {
  return lastFetchTime;
}

function setRefreshing(v: boolean) {
  if (_isRefreshing !== v) {
    _isRefreshing = v;
    notifyRefresh();
  }
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
    prompt: row.prompt != null ? String(row.prompt) : null,
    note: row.note != null ? String(row.note) : null,
    isPublic: Boolean(row.isPublic ?? row.is_public),
  };
}

async function apiFetch(limit: number): Promise<CachedGeneration[] | null> {
  const res = await fetch(`/api/generations?limit=${limit}&light=1`);
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json || !Array.isArray(json.items)) return null;
  return json.items.map((r: Record<string, unknown>) => parseRow(r));
}

async function doFetch(full: boolean): Promise<void> {
  setRefreshing(true);
  try {
    if (full) {
      // Phase 1: small fetch for fast first paint
      const phase1 = await apiFetch(PHASE1_LIMIT);
      if (phase1 && phase1.length > 0) {
        cachedItems = phase1;
        lastFetchTime = Date.now();
        notify();
      }
      // Phase 2: full fetch for complete list
      const data = await apiFetch(FULL_LIMIT);
      if (data && data.length >= 0) {
        cachedItems = data;
        lastFetchTime = Date.now();
        persistToStorage();
        notify();
      }
    } else {
      const data = await apiFetch(FAST_LIMIT);
      if (data && data.length >= 0) {
        cachedItems = data;
        lastFetchTime = Date.now();
        persistToStorage();
        notify();
      }
    }
  } catch {
    // Keep existing cache on failure; don't clear
  } finally {
    setRefreshing(false);
  }
}

/**
 * Fetch generations with smart caching:
 * - Always returns cached data instantly if available (even stale).
 * - Triggers background refresh when stale.
 * - Only blocks on first-ever load (no cache at all).
 * @param full If true, fetches FULL_LIMIT. Use on History page; skip for dashboard.
 */
export async function fetchGenerations(force = false, full = false): Promise<CachedGeneration[]> {
  const isStale = Date.now() - lastFetchTime > STALE_MS;

  // Fresh cache: return immediately, no fetch
  if (!force && !isStale && lastFetchTime > 0) {
    return cachedItems;
  }

  // Stale cache or forced: show stale data, refresh in background
  if (lastFetchTime > 0) {
    if (!fetchPromise) {
      fetchPromise = doFetch(full).finally(() => { fetchPromise = null; });
    }
    // Don't await — return stale data immediately
    return cachedItems;
  }

  // No cache at all: must wait for first fetch
  if (!fetchPromise) {
    fetchPromise = doFetch(full).finally(() => { fetchPromise = null; });
  }
  await fetchPromise;
  return cachedItems;
}

export function invalidateGenerationsCache(): void {
  lastFetchTime = 0;
}

export function addToCachedGenerations(item: CachedGeneration): void {
  cachedItems = [item, ...cachedItems.filter((g) => g.id !== item.id)];
  persistToStorage();
  notify();
}

export function removeFromCachedGenerations(id: string): void {
  cachedItems = cachedItems.filter((g) => g.id !== id);
  persistToStorage();
  notify();
}

/** Update a single generation in cache (e.g. after PATCH). Merges partial into existing. */
export function updateCachedGeneration(
  id: string,
  partial: Partial<Pick<CachedGeneration, "isPublic" | "tags" | "projectId" | "note">>
): void {
  const idx = cachedItems.findIndex((g) => g.id === id);
  if (idx < 0) return;
  const g = cachedItems[idx];
  if (partial.isPublic !== undefined) g.isPublic = partial.isPublic;
  if (partial.tags !== undefined) g.tags = partial.tags;
  if (partial.projectId !== undefined) g.projectId = partial.projectId;
  if (partial.note !== undefined) g.note = partial.note;
  persistToStorage();
  notify();
}

/** Batch update cache (e.g. after batch PATCH). Merges tagsToAdd; sets isPublic/projectId when provided. */
export function updateCachedGenerations(
  ids: string[],
  updates: {
    isPublic?: boolean;
    projectId?: string | null;
    tagsToAdd?: string[];
  }
): void {
  const idSet = new Set(ids);
  for (const g of cachedItems) {
    if (!idSet.has(g.id)) continue;
    if (updates.isPublic !== undefined) g.isPublic = updates.isPublic;
    if (updates.projectId !== undefined) g.projectId = updates.projectId;
    if (updates.tagsToAdd?.length) {
      const current = g.tags ?? [];
      g.tags = Array.from(new Set([...current.map((t) => t.toLowerCase()), ...updates.tagsToAdd.map((t) => t.toLowerCase())]));
    }
  }
  persistToStorage();
  notify();
}
