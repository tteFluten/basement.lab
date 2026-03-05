"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import {
  fetchGenerations,
  getCachedGenerations,
  isCacheReady,
  isRefreshing as getIsRefreshing,
  getLastFetchTime,
  subscribeGenerations,
  subscribeRefreshing,
  invalidateGenerationsCache,
  type CachedGeneration,
} from "./generationsCache";

const EMPTY: CachedGeneration[] = [];

/**
 * Returns cached generations instantly if available, triggers background refresh.
 * Never shows a loading spinner if data was already loaded once in the session.
 * Returns `refreshing` flag so UI can show a subtle indicator during background updates.
 *
 * Uses useSyncExternalStore so server snapshot is always [] — no hydration mismatch.
 */
export function useGenerations(limit?: number) {
  const allItems = useSyncExternalStore(
    subscribeGenerations,
    getCachedGenerations,
    () => EMPTY, // server snapshot — always empty, matches SSR output
  );

  const items = useMemo(
    () => (limit ? allItems.slice(0, limit) : allItems),
    [allItems, limit],
  );

  // Server-safe initial values (match what SSR renders)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);

  useEffect(() => {
    const onRefresh = () => setRefreshing(getIsRefreshing());
    const unsubRefresh = subscribeRefreshing(onRefresh);

    if (isCacheReady()) {
      setLoading(false);
      setLastUpdated(getLastFetchTime());
      // Trigger background refresh if stale (non-blocking)
      fetchGenerations();
    } else {
      setLoading(true);
      fetchGenerations().then(() => {
        setLoading(false);
        setLastUpdated(getLastFetchTime());
      });
    }

    return () => { unsubRefresh(); };
  }, [limit]);

  const forceRefresh = useCallback(() => {
    invalidateGenerationsCache();
    fetchGenerations(true).then(() => {
      setLastUpdated(getLastFetchTime());
    });
  }, []);

  return { items, loading, refreshing, lastUpdated, refresh: forceRefresh };
}
