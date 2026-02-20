"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Film,
  ScanEye,
  Clock,
  Shirt,
  UserCircle,
  History,
  FolderOpen,
  User,
  ChevronDown,
  LogOut,
  User as UserIcon,
} from "lucide-react";

const APP_LINKS = [
  { slug: "cineprompt", label: "CinePrompt", Icon: Film },
  { slug: "pov", label: "POV", Icon: ScanEye },
  { slug: "chronos", label: "Chronos", Icon: Clock },
  { slug: "swag", label: "Swag", Icon: Shirt },
  { slug: "avatar", label: "Avatar", Icon: UserCircle },
] as const;

const iconSize = 18;

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open]);

  const displayName = "User";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 text-fg-muted hover:text-fg border border-transparent hover:border-border"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="flex h-7 w-7 items-center justify-center border border-border bg-bg-muted text-fg text-xs">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="text-sm max-w-[120px] truncate">{displayName}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full mt-1 min-w-[180px] border border-border bg-bg-muted py-1 z-50"
          role="menu"
        >
          <li role="none">
            <Link
              href="/profile"
              className="flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-bg"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <UserIcon size={14} />
              Profile
            </Link>
          </li>
          <li role="none">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fg-muted hover:bg-bg hover:text-fg"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <LogOut size={14} />
              Log out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export function Toolbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-bg-muted shrink-0">
      <nav className="flex items-center gap-4 px-4 py-2 flex-wrap">
        <Link
          href="/"
          className="text-fg font-medium hover:text-fg-muted shrink-0"
        >
          Basement Lab
        </Link>

        <span className="w-px h-5 bg-border shrink-0" aria-hidden />

        {APP_LINKS.map(({ slug, label, Icon }) => {
          const href = `/apps/${slug}`;
          const active = pathname === href;
          return (
            <Link
              key={slug}
              href={href}
              title={label}
              className={`p-1.5 shrink-0 ${active ? "text-fg border-b border-fg" : "text-fg-muted hover:text-fg"}`}
            >
              <Icon size={iconSize} strokeWidth={1.5} />
            </Link>
          );
        })}

        <span className="flex-1 min-w-4" />

        <Link
          href="/history"
          title="History"
          className="p-1.5 text-fg-muted hover:text-fg shrink-0"
        >
          <History size={iconSize} strokeWidth={1.5} />
        </Link>
        <button
          type="button"
          title="Project"
          className="p-1.5 text-fg-muted hover:text-fg shrink-0"
        >
          <FolderOpen size={iconSize} strokeWidth={1.5} />
        </button>
        <UserMenu />
      </nav>
    </header>
  );
}
