"use client";

import {
  Film,
  ScanEye,
  Clock,
  Shirt,
  UserCircle,
  ImagePlus,
  Layers,
  Blocks,
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
  connect: Blocks,
};

export function getAppIcon(appId: string): LucideIcon {
  return APP_ICONS[appId] ?? ImagePlus;
}

const APP_LABELS: Record<string, string> = {
    cineprompt: "CinePrompt",
    pov: "POV",
    chronos: "Chronos",
    swag: "Swag",
    avatar: "Avatar",
    render: "Render",
    "frame-variator": "Frame Variator",
    connect: "Connect",
};

export function getAppLabel(appId: string): string {
  return APP_LABELS[appId] ?? appId;
}

export function getAppIds(): string[] {
  return Object.keys(APP_LABELS);
}
