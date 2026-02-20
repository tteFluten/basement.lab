"use client";

import {
  Film,
  ScanEye,
  Clock,
  Shirt,
  UserCircle,
  ImagePlus,
  Layers,
  type LucideIcon,
} from "lucide-react";

const APP_ICONS: Record<string, LucideIcon> = {
  cineprompt: Film,
  pov: ScanEye,
  chronos: Clock,
  swag: Shirt,
  avatar: UserCircle,
  render: ImagePlus,
  "frame-variator": Layers,
};

export function getAppIcon(appId: string): LucideIcon {
  return APP_ICONS[appId] ?? ImagePlus;
}

export function getAppLabel(appId: string): string {
  const labels: Record<string, string> = {
    cineprompt: "CinePrompt",
    pov: "POV",
    chronos: "Chronos",
    swag: "Swag",
    avatar: "Avatar",
    render: "Render",
    "frame-variator": "Frame Variator",
  };
  return labels[appId] ?? appId;
}
