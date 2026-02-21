"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import * as LucideIcons from "lucide-react";

const ICON_NAMES: string[] = [
  "Activity", "Airplay", "AlertCircle", "AlertTriangle", "Archive", "ArrowRight",
  "Atom", "Award", "Banana", "Barcode", "Battery", "BatteryCharging", "Beaker",
  "Bell", "Bike", "Binary", "Bluetooth", "Bomb", "Bookmark", "Bot",
  "Box", "Brain", "Briefcase", "Brush", "Bug", "Building", "Building2",
  "Bus", "Cable", "Cake", "Calculator", "Calendar", "Camera", "Car",
  "CaseSensitive", "Cast", "ChartBar", "ChartLine", "ChartPie",
  "Check", "CheckCircle", "Chrome", "Clapperboard", "Clipboard",
  "Clock", "Cloud", "CloudDownload", "CloudUpload", "Code", "Code2",
  "Codepen", "Cog", "Coins", "Columns", "Command", "Compass",
  "Component", "Computer", "Construction", "Contact", "Container", "Cookie",
  "Copy", "Copyright", "Cpu", "CreditCard", "Crop", "Crown", "Cube",
  "Database", "Delete", "Diamond", "Dice1", "Dice5", "Disc",
  "DollarSign", "Download", "Dribbble", "Droplet", "Droplets",
  "Ear", "Edit", "Egg", "Equal", "Eraser", "Euro", "Expand",
  "ExternalLink", "Eye", "EyeOff", "Facebook", "Factory", "Fan",
  "FastForward", "Feather", "Figma", "File", "FileCode", "FileImage",
  "FileJson", "FileText", "Film", "Filter", "Fingerprint", "Flag",
  "Flame", "Flashlight", "Flask", "FlipHorizontal", "Flower",
  "Focus", "Folder", "FolderOpen", "Footprints", "Forklift",
  "Frame", "Framer", "Frown", "Fuel", "Gamepad", "Gauge", "Gem",
  "Ghost", "Gift", "GitBranch", "GitCommit", "GitMerge", "Github",
  "Gitlab", "Globe", "Globe2", "GraduationCap", "Grape", "Grid3X3",
  "Grip", "Hammer", "HandMetal", "HardDrive", "Hash",
  "Headphones", "Heart", "HelpCircle", "Hexagon", "Highlighter",
  "Home", "Hop", "Hotel", "Hourglass", "IceCream",
  "Image", "ImagePlus", "Inbox", "Infinity", "Info", "Instagram",
  "Italic", "Joystick", "Key", "Keyboard", "Lamp", "Landmark",
  "Languages", "Laptop", "Laugh", "Layers", "Layout",
  "LayoutDashboard", "LayoutGrid", "LayoutList", "Leaf", "Library",
  "Lightbulb", "Link", "Link2", "Linkedin", "List", "ListChecks",
  "Loader", "Lock", "LogIn", "LogOut", "Luggage",
  "Magnet", "Mail", "Map", "MapPin", "Maximize", "Medal",
  "Megaphone", "Meh", "Menu", "MessageCircle", "MessageSquare", "Mic",
  "Microscope", "Milestone", "Milk", "Minimize", "Monitor",
  "Moon", "Mountain", "Mouse", "Move", "Music", "Navigation",
  "Network", "Newspaper", "Octagon", "Option", "Orbit",
  "Package", "Paintbrush", "Palette", "Palmtree", "Paperclip",
  "Pause", "PenTool", "Pencil", "Phone", "Pi", "PieChart",
  "Pin", "Pizza", "Plane", "Play", "Plug", "Plus",
  "Podcast", "Pointer", "Popcorn", "Power", "Printer",
  "Puzzle", "QrCode", "Quote", "Rabbit", "Radar",
  "Radio", "Rat", "Receipt", "RectangleHorizontal", "Recycle",
  "Refrigerator", "Repeat", "Reply", "Rewind", "Ribbon",
  "Rocket", "RollerCoaster", "Rotate3D", "Rss", "Ruler",
  "Sailboat", "Save", "Scale", "Scan", "School",
  "Scissors", "ScreenShare", "ScrollText", "Search", "Send",
  "Server", "Settings", "Share", "Share2", "Sheet",
  "Shield", "Ship", "Shirt", "ShoppingBag", "ShoppingCart",
  "Shovel", "Shrink", "Shuffle", "Sigma", "Signal",
  "Skull", "Slack", "Slice", "Sliders", "Smartphone",
  "Smile", "Snowflake", "Sofa", "Sparkle", "Sparkles",
  "Speaker", "Spline", "Split", "Sprout", "Square",
  "SquareStack", "Star", "Stethoscope", "Sticker", "Store",
  "Sun", "Sunrise", "Sunset", "Swords", "Syringe",
  "Table", "Tablet", "Tag", "Target", "Tent",
  "Terminal", "TestTube", "Thermometer", "ThumbsDown", "ThumbsUp",
  "Ticket", "Timer", "ToggleLeft", "ToggleRight", "Tornado",
  "Tractor", "TrafficCone", "Train", "Trash", "Trash2",
  "TreePine", "Trees", "Triangle", "Trophy", "Truck",
  "Tv", "Twitch", "Twitter", "Type", "Umbrella",
  "Underline", "Undo", "Unlink", "Unlock", "Upload",
  "Usb", "User", "UserCircle", "UserPlus", "Users",
  "Utensils", "Variable", "Video", "Voicemail", "Volume2",
  "Wallet", "Wand", "Wand2", "Warehouse", "Watch",
  "Waves", "Webcam", "Webhook", "Wifi", "Wind",
  "Wine", "Wrench", "X", "XCircle", "Youtube",
  "Zap", "ZoomIn", "ZoomOut",
];

const iconMap = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>;

function getIcon(name: string): LucideIcons.LucideIcon | null {
  return iconMap[name] ?? null;
}

type Props = {
  value: string | null;
  onChange: (iconName: string | null) => void;
  onClose: () => void;
};

export function IconPicker({ value, onChange, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return ICON_NAMES;
    const q = search.toLowerCase();
    return ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-bg border border-border w-full max-w-lg mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-medium text-fg">Select Icon</h3>
          <button onClick={onClose} className="text-fg-muted hover:text-fg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 border border-border px-3 py-2">
            <Search className="w-4 h-4 text-fg-muted shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="bg-transparent text-sm text-fg outline-none w-full"
              autoFocus
            />
          </div>
        </div>

        {value && (
          <div className="px-4 pt-3 flex items-center gap-2">
            <span className="text-[10px] text-fg-muted uppercase tracking-wider">Current:</span>
            <span className="text-xs text-fg font-medium">{value}</span>
            <button
              onClick={() => { onChange(null); onClose(); }}
              className="text-[10px] text-red-400 hover:text-red-300 ml-auto"
            >
              Remove
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
            {filtered.map((name) => {
              const Icon = getIcon(name);
              if (!Icon) return null;
              const isSelected = value === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); onClose(); }}
                  title={name}
                  className={`flex items-center justify-center w-full aspect-square border transition-colors ${
                    isSelected
                      ? "border-fg bg-fg text-bg"
                      : "border-transparent hover:border-border hover:bg-bg-muted text-fg-muted hover:text-fg"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.5} />
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-fg-muted py-8">No icons match &ldquo;{search}&rdquo;</p>
          )}
        </div>
      </div>
    </div>
  );
}
