"use client";

import { useEffect } from "react";
import { startBackgroundSync } from "@/lib/generationsCache";

/** Mounts once in the root layout to keep generationsCache fresh in the background. */
export function BackgroundSync() {
  useEffect(() => startBackgroundSync(60_000), []);
  return null;
}
