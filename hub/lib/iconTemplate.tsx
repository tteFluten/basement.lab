"use client";

import * as LucideIcons from "lucide-react";
import {
  Film,
  Clock,
  Shirt,
  UserCircle,
  ImagePlus,
  Layers,
  Blocks,
  Globe,
  Palette,
  Code2,
  Layout,
  Sparkles,
  Camera,
  Video,
  Music,
  FileImage,
  Box,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Icon options for app thumbnails (when no image). Name is stored in DB. */
export const ICON_TEMPLATE: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: "film", label: "Film", Icon: Film },
  { name: "clock", label: "Clock", Icon: Clock },
  { name: "shirt", label: "Shirt", Icon: Shirt },
  { name: "user-circle", label: "User", Icon: UserCircle },
  { name: "image-plus", label: "Image", Icon: ImagePlus },
  { name: "layers", label: "Layers", Icon: Layers },
  { name: "blocks", label: "Blocks", Icon: Blocks },
  { name: "globe", label: "Globe", Icon: Globe },
  { name: "palette", label: "Palette", Icon: Palette },
  { name: "code-2", label: "Code", Icon: Code2 },
  { name: "layout", label: "Layout", Icon: Layout },
  { name: "sparkles", label: "Sparkles", Icon: Sparkles },
  { name: "camera", label: "Camera", Icon: Camera },
  { name: "video", label: "Video", Icon: Video },
  { name: "music", label: "Music", Icon: Music },
  { name: "file-image", label: "File image", Icon: FileImage },
  { name: "box", label: "Box", Icon: Box },
  { name: "zap", label: "Zap", Icon: Zap },
];

const iconByName = new Map(ICON_TEMPLATE.map((t) => [t.name, t.Icon]));
const lucideMap = LucideIcons as unknown as Record<string, LucideIcon>;

export function getTemplateIcon(name: string | null | undefined): LucideIcon | null {
  if (!name || typeof name !== "string") return null;
  const n = name.trim();
  const byKebab = iconByName.get(n.toLowerCase());
  if (byKebab) return byKebab;
  const byPascal = lucideMap[n];
  if (byPascal && typeof byPascal === "function") return byPascal;
  return null;
}
