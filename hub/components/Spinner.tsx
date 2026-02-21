"use client";

import { Loader2 } from "lucide-react";

type Props = {
  size?: number;
  label?: string;
  className?: string;
};

export function Spinner({ size = 24, label, className }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className ?? ""}`}>
      <Loader2 size={size} className="text-fg-muted animate-spin" strokeWidth={1.5} />
      {label && <p className="text-xs text-fg-muted">{label}</p>}
    </div>
  );
}
