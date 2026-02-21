"use client";

import { useAppTabs } from "@/lib/appTabsContext";
import { AppTabsContainer } from "@/components/AppTabsContainer";

export function ContentWithTabs({ children }: { children: React.ReactNode }) {
  const { activeSlug, openTabs } = useAppTabs();

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {openTabs.length > 0 && <AppTabsContainer />}
      <div
        className={
          activeSlug
            ? "hidden"
            : "flex-1 min-h-0 flex flex-col"
        }
      >
        {children}
      </div>
    </div>
  );
}
