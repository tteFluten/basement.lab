import Link from "next/link";
import { Film, Clock, Shirt, UserCircle, ImagePlus, Layers, ArrowRight } from "lucide-react";
import { DashboardHistory } from "./DashboardHistory";

const APPS = [
  { slug: "cineprompt", label: "CinePrompt", desc: "Create images with a concrete style", Icon: Film, color: "#1a1215", span: "col-span-2 row-span-2" },
  { slug: "render", label: "Render", desc: "4K render from viewport previews and prompts", Icon: ImagePlus, color: "#1a1611", span: "col-span-1 row-span-2" },
  { slug: "chronos", label: "Chronos", desc: "Change temporality of an image", Icon: Clock, color: "#111520", span: "col-span-1 row-span-1" },
  { slug: "swag", label: "Swag", desc: "Logo placement and mockups", Icon: Shirt, color: "#111a14", span: "col-span-1 row-span-1" },
  { slug: "avatar", label: "Avatar", desc: "Corporate avatar standardization", Icon: UserCircle, color: "#15111a", span: "col-span-1 row-span-1" },
  { slug: "frame-variator", label: "Frame Variator", desc: "Camera and narrative frame variations", Icon: Layers, color: "#111a1a", span: "col-span-2 row-span-1" },
];

export default function HomePage() {
  return (
    <main className="min-h-[80vh] bg-bg text-fg p-8 lg:p-10">
      <h1 className="text-lg font-medium text-fg border-b border-border pb-4 mb-8">
        Basement Lab
      </h1>

      {/* Metro mosaic grid */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-fg-muted uppercase tracking-[0.2em] mb-4">Apps</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 auto-rows-[140px] sm:auto-rows-[160px] md:auto-rows-[180px] gap-3">
          {APPS.map(({ slug, label, desc, Icon, color, span }) => (
            <Link
              key={slug}
              href={`/apps/${slug}`}
              className={`${span} group relative overflow-hidden border border-border hover:border-fg-muted transition-all duration-300 flex flex-col justify-end p-5`}
              style={{ backgroundColor: color }}
            >
              <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icon size={48} strokeWidth={1} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-border/60 text-fg-muted group-hover:text-fg group-hover:border-fg-muted transition-colors">
                    <Icon size={14} strokeWidth={1.5} />
                  </span>
                  <span className="text-sm font-medium text-fg group-hover:text-white transition-colors">{label}</span>
                </div>
                <p className="text-xs text-fg-muted group-hover:text-zinc-400 transition-colors leading-relaxed">{desc}</p>
              </div>
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-4 h-4 text-fg-muted" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent history */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-fg-muted uppercase tracking-[0.2em]">Recent Generations</h2>
          <Link href="/history" className="text-xs text-fg-muted hover:text-fg transition-colors flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <DashboardHistory />
      </section>
    </main>
  );
}
