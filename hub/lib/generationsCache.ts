"use client";

/**
 * Global client-side cache for API generations.
 * Persists lightweight metadata to localStorage for instant cold starts.
 * Two-phase fetch: fast initial batch + full dataset in background.
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
}

type Listener = () => void;

const LS_KEY = "bl_gen_cache";
const LS_TS_KEY = "bl_gen_cache_ts";
const STALE_MS = 60_000;
const FAST_LIMIT = 24;
const FULL_LIMIT = 200;

let cachedItems: CachedGeneration[] = [];
let lastFetchTime = 0;
let fetchPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function persistToStorage() {
  try {
    const slim = cachedItems.map((g) => ({
      id: g.id, a: g.appId, b: g.blobUrl ?? null, t: g.thumbUrl ?? null,
      w: g.width ?? null, h: g.height ?? null, n: g.name ?? null,
      c: g.createdAt, tg: g.tags?.length ? g.tags : undefined,
      p: g.projectId ?? null, u: g.userId ?? null,
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
    prompt: row.prompt != null ? String(row.prompt) : null,
    note: row.note != null ? String(row.note) : null,
  };
}

async function apiFetch(limit: number): Promise<CachedGeneration[] | null> {
  try {
    const res = await fetch(`/api/generations?limit=${limit}&light=1`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json?.items)) return null;
    return json.items.map((r: Record<string, unknown>) => parseRow(r));
  } catch {
    return null;
  }
}

async function doFetch(): Promise<void> {
  const fastP = apiFetch(FAST_LIMIT);
  const fullP = apiFetch(FULL_LIMIT);

  const fast = await fastP;
  if (fast) {
    cachedItems = fast;
    lastFetchTime = Date.now();
    notify();
  }

  const full = await fullP;
  if (full) {
    cachedItems = full;
    lastFetchTime = Date.now();
    persistToStorage();
    notify();
  }
}

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
  persistToStorage();
  notify();
}

export function removeFromCachedGenerations(id: string): void {
  cachedItems = cachedItems.filter((g) => g.id !== id);
  persistToStorage();
  notify();
}
