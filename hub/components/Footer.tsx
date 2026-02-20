"use client";

import { useCallback, useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function Footer() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

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

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("basement-lab-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  if (!mounted) {
    return (
      <footer className="border-t border-border bg-bg-muted shrink-0 px-4 py-2 flex justify-end">
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
    <footer className="border-t border-border bg-bg-muted shrink-0 px-4 py-2 flex justify-end items-center">
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
