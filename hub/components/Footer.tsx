"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const IDLE_PROMPTS = [
  "Harvest no se carga solo. Todavía.",
  "Patas puede abrir apps, cargar imágenes del historial y crear proyectos de feedback. Preguntale.",
  "Feedback: creá una sesión con video, imagen o URL. El link /share/feedback/[id] es público, sin login.",
  "El modelo de imagen se puede cambiar por app desde el selector en el footer.",
  "NanoBanana acepta @menciones de imágenes del historial como referencias visuales.",
  "Podés marcar generaciones como públicas o privadas antes de guardar. El switch está abajo a la derecha.",
  "Frame Variator genera variaciones cinematográficas de una misma imagen: ángulo, distancia, narrativa.",
  "Chronos toma una imagen y la transforma en el tiempo: pasado, presente, futuro.",
  "Swag hace mockups de logo sobre cualquier superficie. Dale una referencia de estilo para afinar el resultado.",
  "Render genera imágenes 4K desde el viewport activo más un prompt de dirección.",
  "Avatar estandariza fotos de perfil corporativas. Útil para onboarding o actualizaciones de equipo.",
  "CinePrompt genera imágenes con estética cinematográfica. El estilo lo definís en el prompt.",
  "El historial de generaciones está en cada app y también accesible desde Patas.",
  "Podés compartir sesiones de feedback con clientes sin que necesiten cuenta en el Hub.",
  "Los proyectos de feedback tienen membresía: podés sumar o sacar gente por proyecto.",
  "Próximamente: Patas va a poder crear y editar sesiones de feedback desde el chat.",
  "Próximamente: más acciones de Patas sobre las apps — ajustar parámetros, encadenar generaciones.",
  "Próximamente: integración con Harvest para ver horas cargadas sin salir del Hub. Ese día llegará.",
  "Próximamente: nuevas apps en el Hub. Si tenés una idea, hablá con Lautaro.",
  "Cualquier bug, pedido de feature o problema de acceso: Lautaro.",
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
