"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const DEFAULT_STEPS = [
  "Loading history",
  "Fetching assets",
  "Cleaning duplicates",
  "Sorting results",
  "Almost there",
];

type Props = {
  size?: number;
  steps?: string[];
  className?: string;
};

export function Spinner({ size = 24, steps = DEFAULT_STEPS, className }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (steps.length <= 1) return;
    const iv = setInterval(() => {
      setIdx((prev) => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(iv);
  }, [steps]);

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className ?? ""}`}>
      <Loader2 size={size} className="text-fg-muted animate-spin" strokeWidth={1.5} />
      <p className="text-xs text-fg-muted transition-opacity duration-300 animate-pulse">
        {steps[idx]}…
      </p>
    </div>
  );
}
