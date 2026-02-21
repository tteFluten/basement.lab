"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

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
};

const AppTabsContext = createContext<AppTabsContextType>({
  openTabs: [],
  activeSlug: null,
  openTab: () => {},
  closeTab: () => {},
});

export const useAppTabs = () => useContext(AppTabsContext);

export function AppTabsProvider({ children }: { children: ReactNode }) {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const pathname = usePathname();
  const router = useRouter();

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
      value={{ openTabs, activeSlug, openTab, closeTab }}
    >
      {children}
    </AppTabsContext.Provider>
  );
}
