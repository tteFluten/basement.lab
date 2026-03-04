"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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

  useEffect(() => {
    setMounted(true);
  }, []);

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
      <footer className="border-t border-border bg-bg-muted shrink-0 px-4 py-2 flex justify-end items-center gap-4">
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
    <footer className="border-t border-border bg-bg-muted shrink-0 px-4 py-2 flex flex-wrap items-center justify-between gap-4">
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
            <span className="flex border border-border">
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
          <span className="text-fg-muted">Select an app to choose model</span>
        )}
      </div>
      <div
        className="flex h-8 border border-border"
        role="switch"
        aria-checked={theme === "light"}
        aria-label="Theme"
      >
        <button
          type="button"
          onClick={() => {
            if (theme !== "light") toggle();
          }}
          title="Light"
          className={`flex w-9 items-center justify-center border-r border-border transition-colors ${theme === "light" ? "bg-fg-muted text-bg" : "text-fg-muted hover:text-fg"}`}
        >
          <Sun size={18} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (theme !== "dark") toggle();
          }}
          title="Dark"
          className={`flex w-9 items-center justify-center transition-colors ${theme === "dark" ? "bg-fg-muted text-bg" : "text-fg-muted hover:text-fg"}`}
        >
          <Moon size={18} strokeWidth={1.5} />
        </button>
      </div>
    </footer>
  );
}
