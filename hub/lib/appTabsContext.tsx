"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

const DEFAULT_PUBLIC_LS_KEY = "basement-lab-default-public";

function getStoredDefaultPublic(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(DEFAULT_PUBLIC_LS_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

export type OpenTab = {
  slug: string;
  label: string;
  url: string;
};

type AppTabsContextType = {
  openTabs: OpenTab[];
  activeSlug: string | null;
  openTab: (slug: string, label: string, url: string) => void;
  closeTab: (slug: string) => void;
  lastGenerationMs: number | null;
  setLastGenerationMs: (ms: number | null) => void;
  defaultIsPublic: boolean;
  setDefaultIsPublic: (value: boolean) => void;
};

const AppTabsContext = createContext<AppTabsContextType>({
  openTabs: [],
  activeSlug: null,
  openTab: () => {},
  closeTab: () => {},
  lastGenerationMs: null,
  setLastGenerationMs: () => {},
  defaultIsPublic: false,
  setDefaultIsPublic: () => {},
});

export const useAppTabs = () => useContext(AppTabsContext);

export function AppTabsProvider({ children }: { children: ReactNode }) {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [lastGenerationMs, setLastGenerationMs] = useState<number | null>(null);
  const [defaultIsPublic, setDefaultIsPublicState] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setDefaultIsPublicState(getStoredDefaultPublic());
  }, []);

  const setDefaultIsPublic = useCallback((value: boolean) => {
    setDefaultIsPublicState(value);
    try {
      window.localStorage.setItem(DEFAULT_PUBLIC_LS_KEY, value ? "true" : "false");
    } catch { /* ignore */ }
  }, []);

  const activeSlug =
    pathname?.startsWith("/apps/") ? (pathname.split("/")[2] ?? null) : null;

  const openTab = useCallback(
    (slug: string, label: string, url: string) => {
      setOpenTabs((prev) => {
        if (prev.some((t) => t.slug === slug)) return prev;
        return [...prev, { slug, label, url }];
      });
    },
    []
  );

  const closeTab = useCallback(
    (slugToClose: string) => {
      setOpenTabs((prev) => {
        const remaining = prev.filter((t) => t.slug !== slugToClose);
        if (activeSlug === slugToClose) {
          queueMicrotask(() => {
            if (remaining.length > 0) {
              router.push(`/apps/${remaining[remaining.length - 1].slug}`);
            } else {
              router.push("/");
            }
          });
        }
        return remaining;
      });
    },
    [activeSlug, router]
  );

  return (
    <AppTabsContext.Provider
      value={{ openTabs, activeSlug, openTab, closeTab, lastGenerationMs, setLastGenerationMs, defaultIsPublic, setDefaultIsPublic }}
    >
      {children}
    </AppTabsContext.Provider>
  );
}
