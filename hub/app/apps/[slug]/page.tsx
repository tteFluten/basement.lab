import { notFound } from "next/navigation";
import { getAppUrl } from "@/lib/appUrls";

const VALID_SLUGS = ["cineprompt", "pov", "chronos", "swag", "avatar"] as const;

type Props = { params: { slug: string } };

export default function AppFramePage({ params }: Props) {
  const { slug } = params;
  if (!VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
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
    </main>
  );
}
