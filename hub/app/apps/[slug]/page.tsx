import { notFound } from "next/navigation";
import { getAppUrl } from "@/lib/appUrls";

const VALID_SLUGS = ["cineprompt", "pov", "chronos", "swag", "avatar"] as const;

type Props = { params: Promise<{ slug: string }> | { slug: string } };

export default async function AppFramePage({ params }: Props) {
  const resolved = params instanceof Promise ? await params : params;
  const slug = resolved?.slug;
  if (!slug || !VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
    notFound();
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
        App at {url}. If it does not load, run that app (e.g. <code className="text-fg">cd {slug} &amp;&amp; npm run dev</code>) or run <code className="text-fg">npm run dev:all</code> from the repo root.
      </p>
    </main>
  );
}
