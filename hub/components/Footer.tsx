"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const IDLE_PROMPTS = [
  "Harvest no se carga solo. Todavía.",
  "El cliente aprobó el diseño, el copy, y los colores. Ahora quiere \"algo más dinámico\". Clásico.",
  "Un prompt bien escrito es un brief bien escrito. Un brief mal escrito es una reunión de dos horas.",
  "La IA no reemplaza el criterio. Lo amplifica. Incluido el criterio de hacer las cosas mal.",
  "Todo sistema complejo que funciona evolucionó de uno simple. El simple no sobrevivió para contarlo.",
  "El problema que describís rara vez es el problema real. El problema real está en el siguiente Zoom.",
  "Las herramientas que usamos moldean lo que somos capaces de imaginar. Las malas herramientas moldean excusas.",
  "El prototipo más feo que funciona vale más que el render más bello. El cliente igual va a pedir el render.",
  "La creatividad no escala, pero los sistemas que la sostienen sí. Salvo el de archivos de Drive.",
  "El código del que más te orgullecés suele ser el que terminás borrando. Y lo volvés a escribir igual.",
  "La simplicidad es el resultado de mucho trabajo. La complejidad, de una reunión sin agenda.",
  "Los mejores equipos no tienen las mejores ideas. Tienen la mejor forma de matar las malas rápido.",
  "La atención es el recurso más escaso en cualquier proyecto. La segunda reunión diaria lo confirma.",
  "El cliente siempre sabe qué no quiere. Rara vez sabe qué quiere. Siempre sabe cuándo no le gustó.",
  "Hacer herramientas para creativos es también un acto creativo. Con el mismo nivel de sufrimiento.",
  "La velocidad de iteración es una ventaja competitiva que se subestima. El cliente la sobreestima.",
  "El trabajo que más importa casi nunca aparece en el Gantt. Tampoco el que nadie quiere hacer.",
  "Las mejores decisiones de diseño son las que no se notan. Las peores tampoco, hasta que es tarde.",
  "Basement existe en la intersección entre lo que la tecnología puede hacer y lo que vale la pena hacer. Acá vivimos.",
  "El 80% de cualquier proyecto es convencer a alguien de algo. El otro 20% es convencerse a uno mismo.",
];
import { Sun, Moon, Lock, Globe } from "lucide-react";
import {
  IMAGE_MODELS,
  getSelectedModel,
  setSelectedModel,
  DEFAULT_IMAGE_MODEL,
} from "@/lib/modelOptions";
import { useAppTabs } from "@/lib/appTabsContext";
import { getAppLabel } from "@/lib/appIcons";

const APP_SLUGS_WITH_IMAGE = [
  "cineprompt",
  "chronos",
  "swag",
  "avatar",
  "render",
  "frame-variator",
  "nanobanana",
];

function getAppSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/apps\/([^/]+)/);
  const slug = match?.[1] ?? null;
  return slug && APP_SLUGS_WITH_IMAGE.includes(slug) ? slug : null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

export function Footer() {
  const pathname = usePathname();
  const appSlug = getAppSlugFromPath(pathname ?? "");
  const { lastGenerationMs, defaultIsPublic, setDefaultIsPublic } = useAppTabs();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);
  const [model, setModel] = useState(DEFAULT_IMAGE_MODEL);
  const [idlePromptIdx, setIdlePromptIdx] = useState(0);
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
    setIdlePromptIdx(Math.floor(Math.random() * IDLE_PROMPTS.length));
  }, []);

  useEffect(() => {
    if (!mounted || appSlug) return;
    idleIntervalRef.current = setInterval(() => {
      setIdlePromptIdx((i) => (i + 1) % IDLE_PROMPTS.length);
    }, 12000);
    return () => { if (idleIntervalRef.current) clearInterval(idleIntervalRef.current); };
  }, [mounted, appSlug]);

  useEffect(() => {
    if (!mounted) return;
    const stored = window.localStorage.getItem("basement-lab-theme") as "dark" | "light" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, [mounted]);

  useEffect(() => {
    if (appSlug && mounted) {
      setModel(getSelectedModel(appSlug));
    }
  }, [appSlug, mounted]);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("basement-lab-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (appSlug) {
        setSelectedModel(appSlug, value);
        setModel(value);
      }
    },
    [appSlug]
  );

  if (!mounted) {
    return (
      <footer className="border-t border-border bg-bg-muted shrink-0 px-4 py-2 flex justify-end items-center gap-4" data-zone="footer">
        <span className="flex h-8 border border-border text-fg-muted">
          <span className="flex w-9 items-center justify-center border-r border-border">
            <Sun size={16} />
          </span>
          <span className="flex w-9 items-center justify-center">
            <Moon size={16} />
          </span>
        </span>
      </footer>
    );
  }

  return (
    <>
    <style>{`
      @keyframes idle-phrase-in {
        from { opacity: 0; transform: translateY(5px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .idle-phrase { animation: idle-phrase-in 0.5s ease both; }
    `}</style>
    <footer className="border-t border-border bg-bg-muted shrink-0 px-4 py-2 flex flex-wrap items-center justify-between gap-4" data-zone="footer">
      <div className="flex items-center gap-3 text-xs">
        {appSlug ? (
          <>
            <span className="text-fg-muted">
              App: <span className="text-fg">{getAppLabel(appSlug)}</span>
            </span>
            <span className="text-fg-muted">Model:</span>
            <select
              value={model}
              onChange={handleModelChange}
              className="bg-bg border border-border px-2 py-1 text-fg focus:outline-none focus:border-fg-muted min-w-[240px] max-w-[280px]"
              title="Image generation model for this app"
              data-zone="model-selector"
            >
              {IMAGE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="text-fg-muted" title="Last generation time">
              Last: {lastGenerationMs != null ? formatDuration(lastGenerationMs) : "—"}
            </span>
            <span className="text-fg-muted">Save as:</span>
            <span className="flex border border-border" data-zone="visibility-toggle">
              <button
                type="button"
                title="New saves will be private (only you)"
                onClick={() => setDefaultIsPublic(false)}
                className={`flex items-center gap-1 px-2 py-1 text-xs border-r border-border ${!defaultIsPublic ? "bg-bg-muted text-fg" : "text-fg-muted hover:text-fg"}`}
              >
                <Lock className="w-3 h-3" /> Private
              </button>
              <button
                type="button"
                title="New saves will be public (visible to everyone)"
                onClick={() => setDefaultIsPublic(true)}
                className={`flex items-center gap-1 px-2 py-1 text-xs ${defaultIsPublic ? "bg-bg-muted text-fg" : "text-fg-muted hover:text-fg"}`}
              >
                <Globe className="w-3 h-3" /> Public
              </button>
            </span>
          </>
        ) : (
          <span key={idlePromptIdx} className="text-fg-muted idle-phrase">{IDLE_PROMPTS[idlePromptIdx]}</span>
        )}
      </div>
      <button
        type="button"
        onClick={toggle}
        role="switch"
        aria-checked={theme === "light"}
        aria-label="Toggle theme"
        title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        data-zone="theme-toggle"
        className="relative h-7 w-14 border border-border bg-bg-muted transition-colors hover:border-fg-muted"
        style={{ borderRadius: 9999 }}
      >
        <div
          className="absolute h-5 w-5 bg-fg-muted transition-all duration-200"
          style={{ borderRadius: 9999, top: 3, left: theme === "light" ? 3 : 31 }}
        />
        <Sun size={12} strokeWidth={1.5} className={`absolute top-1/2 -translate-y-1/2 transition-colors ${theme === "light" ? "text-bg" : "text-fg-muted/50"}`} style={{ left: 9 }} />
        <Moon size={12} strokeWidth={1.5} className={`absolute top-1/2 -translate-y-1/2 transition-colors ${theme === "dark" ? "text-bg" : "text-fg-muted/50"}`} style={{ right: 9 }} />
      </button>
    </footer>
    </>
  );
}
