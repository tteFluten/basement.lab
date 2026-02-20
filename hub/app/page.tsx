import Link from "next/link";
import { Film, Clock, Shirt, UserCircle, ImagePlus, Layers } from "lucide-react";

const APPS = [
  { slug: "cineprompt", label: "CinePrompt", desc: "Create images with a concrete style", Icon: Film },
  { slug: "chronos", label: "Chronos", desc: "Change temporality of an image", Icon: Clock },
  { slug: "swag", label: "Swag", desc: "Logo placement and mockups", Icon: Shirt },
  { slug: "avatar", label: "Avatar", desc: "Corporate avatar standardization", Icon: UserCircle },
  { slug: "render", label: "Render", desc: "4K render from viewport previews and prompts", Icon: ImagePlus },
  { slug: "frame-variator", label: "Frame Variator", desc: "Camera and narrative frame variations", Icon: Layers },
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
        {APPS.map(({ slug, label, desc, Icon }) => (
          <li key={slug}>
            <Link
              href={`/apps/${slug}`}
              className="flex items-center gap-3 p-4 border border-border hover:border-fg-muted bg-bg-muted hover:bg-bg text-fg"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-border text-fg-muted">
                <Icon size={18} strokeWidth={1.5} />
              </span>
              <span>
                <span className="font-medium">{label}</span>
                <span className="text-fg-muted text-sm ml-2">— {desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
