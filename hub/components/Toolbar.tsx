"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Film,
  Clock,
  Shirt,
  UserCircle,
  ImagePlus,
  Layers,
  History,
  FolderOpen,
  Blocks,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Shield,
  Package,
  ExternalLink,
  ArrowRight,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { getCurrentProjectId, setCurrentProjectId } from "@/lib/currentProject";
import { getTemplateIcon } from "@/lib/iconTemplate";
import { Image as ImageIcon } from "lucide-react";
import { useAppTabs } from "@/lib/appTabsContext";

const APP_LINKS = [
  { slug: "cineprompt", label: "CinePrompt", Icon: Film },
  { slug: "chronos", label: "Chronos", Icon: Clock },
  { slug: "swag", label: "Swag", Icon: Shirt },
  { slug: "avatar", label: "Avatar", Icon: UserCircle },
  { slug: "render", label: "Render", Icon: ImagePlus },
  { slug: "frame-variator", label: "Frame Variator", Icon: Layers },
] as const;

const PROJECT_APP_LINKS = [
  {
    key: "native-connect",
    label: "Connect",
    project: "Native",
    slug: "connect",
  },
] as const;

const iconSize = 18;

type Project = { id: string; name: string };

function ProjectSelector() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.items) ? data.items : [];
        setProjects(list);
        const id = getCurrentProjectId();
        setCurrentId(id);
        if (list.length === 1 && !id) {
          setCurrentProjectId(list[0].id);
          setCurrentId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open]);

  const currentName = projects.find((p) => p.id === currentId)?.name ?? "Project";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Current project (saves go here)"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 p-1.5 shrink-0 max-w-[140px] ${
          open ? "text-fg border-b border-fg" : "text-fg-muted hover:text-fg"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <FolderOpen size={iconSize} strokeWidth={1.5} />
        <span className="text-xs truncate">{currentName}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full mt-1 min-w-[200px] border border-border bg-bg-muted py-1 z-50 max-h-[280px] overflow-auto"
          role="menu"
        >
          {projects.length === 0 ? (
            <li className="px-3 py-2 text-xs text-fg-muted">
              No projects. Admin can create in Dashboard.
            </li>
          ) : (
            projects.map((p) => (
              <li key={p.id} role="none">
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-bg ${
                    currentId === p.id ? "text-fg font-medium" : "text-fg-muted"
                  }`}
                  role="menuitem"
                  onClick={() => {
                    setCurrentProjectId(p.id);
                    setCurrentId(p.id);
                    setOpen(false);
                  }}
                >
                  {p.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function ProjectAppsMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasActiveProjectApp = PROJECT_APP_LINKS.some(
    ({ slug }) => pathname === `/apps/${slug}`
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Apps nativas"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 p-1.5 shrink-0 ${
          open || hasActiveProjectApp
            ? "text-fg border-b border-fg"
            : "text-fg-muted hover:text-fg"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Blocks size={iconSize} strokeWidth={1.5} />
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <ul
          className="absolute left-0 top-full mt-1 min-w-[220px] border border-border bg-bg-muted py-1 z-50"
          role="menu"
        >
          {PROJECT_APP_LINKS.map(({ key, label, project, slug }) => (
            <li key={key} role="none">
              <Link
                href={`/apps/${slug}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-fg hover:bg-bg"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <span className="truncate">{label}</span>
                <span className="text-xs text-fg-muted shrink-0">{project}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type SubmittedAppBrief = {
  id: string;
  title: string;
  deployLink: string;
  thumbnailUrl: string | null;
  icon: string | null;
  createdAt: number;
  external?: boolean;
};

function SubmittedAppsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SubmittedAppBrief[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/submitted-apps?limit=8")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d?.items) ? d.items : [];
        setItems(
          list.map((r: Record<string, unknown>) => ({
            id: String(r.id ?? ""),
            title: String(r.title ?? ""),
            deployLink: String(r.deployLink ?? ""),
            thumbnailUrl: r.thumbnailUrl != null ? String(r.thumbnailUrl) : null,
            icon: r.icon != null ? String(r.icon) : null,
            createdAt: typeof r.createdAt === "number" ? r.createdAt : 0,
            external: Boolean(r.external),
          }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Submitted applications"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 p-1.5 shrink-0 ${
          open ? "text-fg border-b border-fg" : "text-fg-muted hover:text-fg"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Package size={iconSize} strokeWidth={1.5} />
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <ul
          className="absolute left-0 top-full mt-1 min-w-[260px] border border-border bg-bg-muted py-1 z-50 max-h-[320px] overflow-auto"
          role="menu"
        >
          {items.length === 0 ? (
            <li className="px-3 py-2 text-xs text-fg-muted">No submitted apps yet.</li>
          ) : (
            items.map((app) => {
              const TplIcon = getTemplateIcon(app.icon);
              const content = (
                <>
                  <span className="w-7 h-7 shrink-0 border border-border bg-bg-muted flex items-center justify-center overflow-hidden">
                    {app.thumbnailUrl ? (
                      <img src={app.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : TplIcon ? (
                      <TplIcon className="w-3.5 h-3.5 text-fg-muted" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-fg-muted opacity-40" />
                    )}
                  </span>
                  <span className="truncate flex-1">{app.title}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                </>
              );
              return (
                <li key={app.id} role="none">
                  {app.external ? (
                    <a
                      href={app.deployLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-bg"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      {content}
                    </a>
                  ) : (
                    <Link
                      href={`/submitted-apps/${app.id}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-bg"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })
          )}
          <li role="none" className="border-t border-border mt-1 pt-1">
            <Link
              href="/submitted-apps"
              className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-fg-muted hover:text-fg hover:bg-bg"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

function UserMenu() {
  const { data: session, status } = useSession();
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

  const displayName =
    status === "authenticated" && session?.user
      ? session.user.name || session.user.email || "User"
      : "User";

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
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/login" });
              }}
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

function TabStrip() {
  const { openTabs, activeSlug, closeTab } = useAppTabs();
  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center gap-px px-4 py-0.5 bg-bg border-t border-border overflow-x-auto">
      {openTabs.map((tab) => {
        const isActive = activeSlug === tab.slug;
        return (
          <div
            key={tab.slug}
            className={`flex items-center gap-1.5 pl-3 pr-1 py-1 text-xs shrink-0 transition-colors ${
              isActive
                ? "bg-bg-muted text-fg"
                : "text-fg-muted hover:text-fg hover:bg-bg-muted/50"
            }`}
          >
            <Link
              href={`/apps/${tab.slug}`}
              className="truncate max-w-[120px]"
            >
              {tab.label}
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeTab(tab.slug);
              }}
              className="p-0.5 rounded-sm opacity-40 hover:opacity-100 hover:bg-border/50 transition-opacity"
              title={`Close ${tab.label}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Toolbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const { openTabs } = useAppTabs();

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
          const isOpenTab = openTabs.some((t) => t.slug === slug);
          return (
            <Link
              key={slug}
              href={href}
              title={label}
              className={`p-1.5 shrink-0 relative ${
                active
                  ? "text-fg border-b border-fg"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <Icon size={iconSize} strokeWidth={1.5} />
              {isOpenTab && !active && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-fg-muted rounded-full" />
              )}
            </Link>
          );
        })}
        <ProjectAppsMenu />
        <SubmittedAppsMenu />

        <span className="flex-1 min-w-4" />

        <Link
          href="/history"
          title="History"
          className="p-1.5 text-fg-muted hover:text-fg shrink-0"
        >
          <History size={iconSize} strokeWidth={1.5} />
        </Link>
        <ProjectSelector />
        {isAdmin && (
          <Link
            href="/admin"
            title="Admin"
            className="p-1.5 text-fg-muted hover:text-fg shrink-0"
          >
            <Shield size={iconSize} strokeWidth={1.5} />
          </Link>
        )}
        <UserMenu />
      </nav>
      <TabStrip />
    </header>
  );
}
