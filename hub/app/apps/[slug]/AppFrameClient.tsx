"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { getAppUrl } from "@/lib/appUrls";
import { useAppTabs } from "@/lib/appTabsContext";

const VALID_SLUGS = [
  "cineprompt",
  "chronos",
  "swag",
  "avatar",
  "render",
  "frame-variator",
  "connect",
] as const;

const APP_LABELS: Record<string, string> = {
  cineprompt: "CinePrompt",
  chronos: "Chronos",
  swag: "Swag",
  avatar: "Avatar",
  render: "Render",
  "frame-variator": "Frame Variator",
  connect: "Connect",
};

export function AppFrameClient() {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const { openTab } = useAppTabs();

  const isValid =
    !!slug && VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number]);
  const url = isValid ? getAppUrl(slug) : "#";
  const label = (slug && APP_LABELS[slug]) || slug || "App";

  useEffect(() => {
    if (isValid && url !== "#") {
      openTab(slug, label, url);
    }
  }, [isValid, slug, label, url, openTab]);

  if (!isValid) {
    return (
      <main className="flex-1 flex flex-col min-h-0 p-8">
        <p className="text-fg-muted">Unknown app.</p>
      </main>
    );
  }

  if (url === "#") {
    return (
      <div className="flex-1 min-h-0 p-8">
        <p className="text-fg">This app is not published yet.</p>
        <p className="text-fg-muted text-sm mt-2">
          Configure{" "}
          <code className="text-fg">
            NEXT_PUBLIC_APP_{slug.toUpperCase()}_URL
          </code>{" "}
          or publish an embed at{" "}
          <code className="text-fg">/embed/{slug}/index.html</code>.
        </p>
      </div>
    );
  }

  return null;
}
