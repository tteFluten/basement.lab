"use client";

import Link from "next/link";
import { Film, Clock, Shirt, UserCircle, ImagePlus, Layers, ArrowRight, Plus } from "lucide-react";
import { useState, useCallback } from "react";
import { SubmittedAppsSection } from "@/components/SubmittedAppsSection";
import { AddSubmittedAppModal } from "@/components/AddSubmittedAppModal";

const APPS = [
  { slug: "cineprompt", label: "CinePrompt", desc: "Create images with a concrete style", Icon: Film, span: "col-span-2 row-span-2", cover: "/app-covers/cineprompt.jpg" },
  { slug: "render", label: "Render", desc: "4K render from viewport previews and prompts", Icon: ImagePlus, span: "col-span-1 row-span-2", cover: "/app-covers/render.jpg" },
  { slug: "chronos", label: "Chronos", desc: "Change temporality of an image", Icon: Clock, span: "col-span-1 row-span-1", cover: "/app-covers/chronos.jpg" },
  { slug: "swag", label: "Swag", desc: "Logo placement and mockups", Icon: Shirt, span: "col-span-1 row-span-1", cover: "/app-covers/swag.jpg" },
  { slug: "avatar", label: "Avatar", desc: "Corporate avatar standardization", Icon: UserCircle, span: "col-span-1 row-span-1", cover: "/app-covers/avatar.jpg" },
  { slug: "frame-variator", label: "Frame Variator", desc: "Camera and narrative frame variations", Icon: Layers, span: "col-span-2 row-span-1", cover: "/app-covers/frame-variator.jpg" },
];

function AppCoverImage({ cover, Icon, alt }: { cover: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-bg-muted">
        <Icon size={48} strokeWidth={1} className="text-fg-muted opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={cover}
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-500"
      onError={() => setFailed(true)}
    />
  );
}

export function HomeAppsSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const onSuccess = useCallback(() => setRefreshTrigger((t) => t + 1), []);

  return (
    <>
      <section className="mb-10">
        <h2 className="text-xs font-bold text-fg-muted uppercase tracking-[0.2em] mb-4">Apps</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 auto-rows-[140px] sm:auto-rows-[160px] md:auto-rows-[180px] gap-3">
          {APPS.map(({ slug, label, desc, Icon, span, cover }) => (
            <Link
              key={slug}
              href={`/apps/${slug}`}
              className={`${span} group relative overflow-hidden border border-border hover:border-fg-muted transition-all duration-300 flex flex-col justify-end p-5 bg-black`}
            >
              <AppCoverImage cover={cover} Icon={Icon} alt={label} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/20 text-white/70 group-hover:text-white group-hover:border-white/40 transition-colors backdrop-blur-sm bg-black/20">
                    <Icon size={14} strokeWidth={1.5} />
                  </span>
                  <span className="text-sm font-medium text-white drop-shadow-sm">{label}</span>
                </div>
                <p className="text-xs text-white/60 group-hover:text-white/80 transition-colors leading-relaxed drop-shadow-sm">{desc}</p>
              </div>
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <ArrowRight className="w-4 h-4 text-white/60" />
              </div>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="col-span-1 row-span-1 flex flex-col items-center justify-center gap-2 border border-dashed border-border hover:border-fg-muted hover:bg-bg-muted/30 transition-all duration-300 text-fg-muted hover:text-fg"
            aria-label="Add application"
          >
            <Plus className="w-8 h-8" strokeWidth={1.5} />
            <span className="text-xs font-medium">Add app</span>
          </button>
        </div>
      </section>
      <SubmittedAppsSection
        onAddClick={() => setModalOpen(true)}
        refreshTrigger={refreshTrigger}
      />
      <AddSubmittedAppModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}
