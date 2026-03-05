"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

/**
 * Returns cached generations instantly if available, triggers background refresh.
 * Never shows a loading spinner if data was already loaded once in the session.
 * Returns `refreshing` flag so UI can show a subtle indicator during background updates.
 */
export function useGenerations(limit?: number) {
  const hasCache = isCacheReady();
  const limitRef = useRef(limit);
  limitRef.current = limit;

  const slice = useCallback(() => {
    const all = getCachedGenerations();
    return limitRef.current ? all.slice(0, limitRef.current) : all;
  }, []);

  const [items, setItems] = useState<CachedGeneration[]>(() => hasCache ? slice() : []);
  const [loading, setLoading] = useState(!hasCache);
  const [refreshing, setRefreshing] = useState(getIsRefreshing());
  const [lastUpdated, setLastUpdated] = useState(getLastFetchTime());

  useEffect(() => {
    const onData = () => {
      setItems(slice());
      setLastUpdated(getLastFetchTime());
    };
    const onRefresh = () => {
      setRefreshing(getIsRefreshing());
    };

    const unsubData = subscribeGenerations(onData);
    const unsubRefresh = subscribeRefreshing(onRefresh);

    if (isCacheReady()) {
      onData();
      setLoading(false);
      // Trigger background refresh if stale (non-blocking)
      fetchGenerations();
    } else {
      setLoading(true);
      fetchGenerations().then(() => {
        onData();
        setLoading(false);
      });
    }

    return () => { unsubData(); unsubRefresh(); };
  }, [limit, slice]);

  const forceRefresh = useCallback(() => {
    invalidateGenerationsCache();
    // Don't set loading=true — show existing data while refreshing
    fetchGenerations(true).then(() => {
      setItems(slice());
      setLastUpdated(getLastFetchTime());
    });
  }, [slice]);

  return { items, loading, refreshing, lastUpdated, refresh: forceRefresh };
}
