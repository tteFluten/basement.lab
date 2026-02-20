import Link from "next/link";

const APPS = [
  { slug: "cineprompt", label: "CinePrompt", desc: "Create images with a concrete style" },
  { slug: "pov", label: "POV", desc: "Change point of view of an image" },
  { slug: "chronos", label: "Chronos", desc: "Change temporality of an image" },
  { slug: "swag", label: "Swag", desc: "Logo placement and mockups" },
  { slug: "avatar", label: "Avatar", desc: "Corporate avatar standardization" },
];

export default function HomePage() {
  return (
    <main className="min-h-[80vh] bg-bg text-fg p-8">
      <h1 className="text-2xl font-medium text-fg border-b border-border pb-2 mb-6">
        Basement Lab
      </h1>
      <p className="text-fg-muted mb-8">
        Pick an app from the toolbar or below.
      </p>
      <ul className="grid gap-4 max-w-xl">
        {APPS.map(({ slug, label, desc }) => (
          <li key={slug}>
            <Link
              href={`/apps/${slug}`}
              className="block p-4 border border-border hover:border-fg-muted bg-bg-muted hover:bg-bg text-fg"
            >
              <span className="font-medium">{label}</span>
              <span className="text-fg-muted text-sm ml-2">— {desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
