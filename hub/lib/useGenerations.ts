"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchGenerations,
  getCachedGenerations,
  isCacheReady,
  subscribeGenerations,
  invalidateGenerationsCache,
  type CachedGeneration,
} from "./generationsCache";

/**
 * Returns cached generations instantly if available, triggers background refresh.
 * Never shows a spinner if data was already loaded once in the session.
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

  useEffect(() => {
    const refresh = () => setItems(slice());
    const unsub = subscribeGenerations(refresh);

    if (isCacheReady()) {
      refresh();
      setLoading(false);
      fetchGenerations();
    } else {
      setLoading(true);
      fetchGenerations().then(() => {
        refresh();
        setLoading(false);
      });
    }

    return unsub;
  }, [limit, slice]);

  const forceRefresh = useCallback(() => {
    invalidateGenerationsCache();
    setLoading(true);
    fetchGenerations(true).then(() => {
      setItems(slice());
      setLoading(false);
    });
  }, [slice]);

  return { items, loading, refresh: forceRefresh };
}
