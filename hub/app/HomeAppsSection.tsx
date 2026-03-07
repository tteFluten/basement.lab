"use client";

import Link from "next/link";
import { Film, Clock, Shirt, UserCircle, ImagePlus, Layers, ArrowRight, Plus, Banana } from "lucide-react";
import { MonkeyIcon } from "@/components/MonkeyIcon";
import { useState, useCallback } from "react";
import { SubmittedAppsSection } from "@/components/SubmittedAppsSection";
import { AddSubmittedAppModal } from "@/components/AddSubmittedAppModal";

const IMAGE_APPS = [
  { slug: "nanobanana", label: "NanoBanana", desc: "Iterative image generation with @mention references", Icon: Banana, span: "col-span-2 row-span-2", cover: "/app-covers/cineprompt.jpg" },
  { slug: "render", label: "Render", desc: "4K render from viewport previews and prompts", Icon: ImagePlus, span: "col-span-1 row-span-2", cover: "/app-covers/render.jpg" },
  { slug: "chronos", label: "Chronos", desc: "Change temporality of an image", Icon: Clock, span: "col-span-1 row-span-1", cover: "/app-covers/chronos.jpg" },
  { slug: "swag", label: "Swag", desc: "Logo placement and mockups", Icon: Shirt, span: "col-span-1 row-span-1", cover: "/app-covers/swag.jpg" },
  { slug: "avatar", label: "Avatar", desc: "Corporate avatar standardization", Icon: UserCircle, span: "col-span-1 row-span-1", cover: "/app-covers/avatar.jpg" },
  { slug: "frame-variator", label: "Frame Variator", desc: "Camera and narrative frame variations", Icon: Layers, span: "col-span-1 row-span-1", cover: "/app-covers/chronos.jpg" },
  { slug: "cineprompt", label: "CinePrompt", desc: "Create images with a concrete style", Icon: Film, span: "col-span-1 row-span-1", cover: "/app-covers/cineprompt.jpg" },
];

const TOOL_APPS = [
  { slug: "feedback", label: "MonoFeedback", desc: "Video annotation and timestamped feedback", Icon: MonkeyIcon, span: "col-span-2 row-span-1", cover: null },
];

const BANANA_COLS = [
  { left: '4%',  dur: '6s',   delay: '0s',    opacity: 0.07, size: 60 },
  { left: '11%', dur: '8s',   delay: '-2.1s', opacity: 0.05, size: 50 },
  { left: '18%', dur: '5.5s', delay: '-4.8s', opacity: 0.08, size: 65 },
  { left: '25%', dur: '7s',   delay: '-1.3s', opacity: 0.06, size: 55 },
  { left: '32%', dur: '9s',   delay: '-6.2s', opacity: 0.07, size: 60 },
  { left: '39%', dur: '6.5s', delay: '-3.5s', opacity: 0.05, size: 50 },
  { left: '46%', dur: '7.5s', delay: '-0.7s', opacity: 0.08, size: 65 },
  { left: '53%', dur: '5s',   delay: '-5.1s', opacity: 0.06, size: 55 },
  { left: '60%', dur: '8.5s', delay: '-2.9s', opacity: 0.07, size: 60 },
  { left: '67%', dur: '6s',   delay: '-4.4s', opacity: 0.05, size: 50 },
  { left: '74%', dur: '7s',   delay: '-1.8s', opacity: 0.08, size: 65 },
  { left: '81%', dur: '9.5s', delay: '-7s',   opacity: 0.06, size: 55 },
  { left: '88%', dur: '5.5s', delay: '-3.3s', opacity: 0.07, size: 60 },
];

function BananaRain() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <style>{`@keyframes nb-fall { from { transform: translateY(-80px); } to { transform: translateY(500px); } }`}</style>
      {BANANA_COLS.map((b, i) => (
        <div key={i} className="absolute top-0" style={{ left: b.left, opacity: b.opacity, animation: `nb-fall ${b.dur} ${b.delay} linear infinite` }}>
          <Banana size={b.size} strokeWidth={1.5} color="white" />
        </div>
      ))}
    </div>
  );
}

function AppCoverImage({ cover, Icon, alt }: { cover: string | null; Icon: React.ComponentType<{ size?: string | number; strokeWidth?: string | number; className?: string }>; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!cover || failed) {
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
          {IMAGE_APPS.map(({ slug, label, desc, Icon, span, cover }) => (
            <Link
              key={slug}
              href={`/apps/${slug}`}
              className={`${span} group relative overflow-hidden border border-border hover:border-fg-muted transition-all duration-300 flex flex-col justify-end p-5 bg-black`}
            >
              <AppCoverImage cover={cover} Icon={Icon} alt={label} />
              {slug === 'nanobanana' && <BananaRain />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/20 text-white/70 group-hover:text-white group-hover:border-white/40 transition-colors backdrop-blur-sm bg-black/20">
                    <Icon size={14} strokeWidth={1.5} />
                  </span>
                  <span className="text-sm font-medium text-white drop-shadow-sm">{label}</span>
                </div>
                <p className="text-xs text-white/60 group-hover:text-white/80 transition-colors leading-relaxed drop-shadow-sm pr-6">{desc}</p>
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

        <div className="flex items-center gap-3 mt-4 mb-3">
          <span className="text-xs font-bold text-fg-muted uppercase tracking-[0.2em]">Tools</span>
          <span className="flex-1 h-px bg-border" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 auto-rows-[140px] sm:auto-rows-[160px] md:auto-rows-[180px] gap-3">
          {TOOL_APPS.map(({ slug, label, desc, Icon, span, cover }) => (
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
                <p className="text-xs text-white/60 group-hover:text-white/80 transition-colors leading-relaxed drop-shadow-sm pr-6">{desc}</p>
              </div>
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <ArrowRight className="w-4 h-4 text-white/60" />
              </div>
            </Link>
          ))}
          <button
            type="button"
            disabled
            className="col-span-1 row-span-1 flex flex-col items-center justify-center gap-2 border border-dashed border-border opacity-30 cursor-not-allowed text-fg-muted"
            aria-label="Add tool"
          >
            <Plus className="w-8 h-8" strokeWidth={1.5} />
            <span className="text-xs font-medium">Add tool</span>
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
