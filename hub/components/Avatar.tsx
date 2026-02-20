"use client";

/**
 * Circular avatar: image or initials fallback.
 * size: "sm" | "md" | "lg" (or number in px for className)
 */
type Size = "sm" | "md" | "lg" | number;

const sizeMap = { sm: 24, md: 32, lg: 40 };

function getSize(size: Size): number {
  return typeof size === "number" ? size : sizeMap[size];
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export function Avatar({
  src,
  name,
  email = "",
  size = "md",
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  email?: string;
  size?: Size;
  className?: string;
}) {
  const px = getSize(size);
  const initials = getInitials(name ?? null, email ?? "");

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-bg-muted text-fg-muted text-[10px] font-medium uppercase ${className}`}
      style={{ width: px, height: px, minWidth: px, minHeight: px }}
      title={name || email || undefined}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="leading-none">{initials}</span>
      )}
    </div>
  );
}
