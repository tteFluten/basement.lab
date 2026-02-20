"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const APP_LINKS = [
  { slug: "cineprompt", label: "CinePrompt" },
  { slug: "pov", label: "POV" },
  { slug: "chronos", label: "Chronos" },
  { slug: "swag", label: "Swag" },
  { slug: "avatar", label: "Avatar" },
] as const;

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && window.localStorage.getItem("basement-lab-theme")) as "dark" | "light" | null;
    const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("basement-lab-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={toggle}
      className="px-2 py-1 text-fg-muted hover:text-fg border border-border hover:border-fg-muted text-sm"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
    >
      {theme === "dark" ? "Day" : "Night"}
    </button>
  );
}

export function Toolbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-bg-muted">
      <nav className="flex items-center gap-6 px-4 py-2 flex-wrap">
        <Link
          href="/"
          className="text-fg font-medium hover:text-fg-muted"
        >
          Basement Lab
        </Link>

        <span className="text-fg-muted text-sm">Apps</span>
        {APP_LINKS.map(({ slug, label }) => {
          const href = `/apps/${slug}`;
          const active = pathname === href;
          return (
            <Link
              key={slug}
              href={href}
              className={`text-sm ${active ? "text-fg border-b border-fg" : "text-fg-muted hover:text-fg"}`}
            >
              {label}
            </Link>
          );
        })}

        <span className="flex-1" />

        <Link
          href="/history"
          className="text-sm text-fg-muted hover:text-fg"
        >
          History
        </Link>
        <span className="text-sm text-fg-muted">Project</span>
        <span className="text-sm text-fg-muted">User</span>
        <ThemeToggle />
      </nav>
    </header>
  );
}
