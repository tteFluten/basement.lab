"use client";

import {
  Film,
  Clock,
  Shirt,
  UserCircle,
  ImagePlus,
  Layers,
  Blocks,
  Banana,
  type LucideIcon,
} from "lucide-react";

const APP_ICONS: Record<string, LucideIcon> = {
  cineprompt: Film,
  chronos: Clock,
  swag: Shirt,
  avatar: UserCircle,
  render: ImagePlus,
  "frame-variator": Layers,
  connect: Blocks,
  nanobanana: Banana,
};

export function getAppIcon(appId: string): LucideIcon {
  return APP_ICONS[appId] ?? ImagePlus;
}

const APP_LABELS: Record<string, string> = {
    cineprompt: "CinePrompt",
    chronos: "Chronos",
    swag: "Swag",
    avatar: "Avatar",
    render: "Render",
    "frame-variator": "Frame Variator",
    connect: "Connect",
    nanobanana: "NanoBanana",
};

export function getAppLabel(appId: string): string {
  return APP_LABELS[appId] ?? appId;
}

export function getAppIds(): string[] {
  return Object.keys(APP_LABELS);
}
