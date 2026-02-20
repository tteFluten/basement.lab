"use client";

import { useParams } from "next/navigation";
import { getAppUrl } from "@/lib/appUrls";

const VALID_SLUGS = ["cineprompt", "pov", "chronos", "swag", "avatar"] as const;

export function AppFrameClient() {
  const params = useParams();
  const slug = params?.slug as string | undefined;

  if (!slug || !VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
    return (
      <main className="flex-1 flex flex-col min-h-0 p-8">
        <p className="text-fg-muted">Unknown app.</p>
      </main>
    );
  }

  const url = getAppUrl(slug);
  return (
    <main className="flex-1 flex flex-col min-h-0">
      <iframe
        title={slug}
        src={url}
        className="w-full flex-1 min-h-0 border-0"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      <p className="text-fg-muted text-xs px-4 py-2 border-t border-border bg-bg-muted shrink-0">
        App at {url}. To rebuild apps, run <code className="text-fg">npm run build:apps</code> from the repo root.
      </p>
    </main>
  );
}
