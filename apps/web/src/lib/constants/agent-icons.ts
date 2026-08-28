import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Anchor,
  Award,
  BarChart3,
  Beaker,
  Bell,
  Bookmark,
  BookOpen,
  Bot,
  Box,
  Brain,
  Briefcase,
  Calendar,
  Camera,
  ChartLine,
  Check,
  Cloud,
  Code2,
  Coffee,
  Compass,
  Cpu,
  Crown,
  Database,
  Diamond,
  Feather,
  FileText,
  Film,
  Flame,
  Folder,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Hammer,
  Headphones,
  Heart,
  Home,
  Image,
  Key,
  Layers,
  Lightbulb,
  Lock,
  Mail,
  Map,
  Megaphone,
  MessageSquare,
  Mic,
  Moon,
  Music,
  Package,
  Palette,
  Pen,
  Pencil,
  Plane,
  Plug,
  Puzzle,
  Rocket,
  Scale,
  Scissors,
  Search,
  Server,
  Settings,
  Shield,
  Ship,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  Tag,
  Target,
  Terminal,
  ThumbsUp,
  Timer,
  TrendingUp,
  Truck,
  Umbrella,
  User,
  Users,
  Video,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";

export const AGENT_ICON_PRESETS: Record<string, LucideIcon> = {
  activity: Activity,
  anchor: Anchor,
  award: Award,
  barChart: BarChart3,
  beaker: Beaker,
  bell: Bell,
  book: BookOpen,
  bookmark: Bookmark,
  bot: Bot,
  box: Box,
  brain: Brain,
  briefcase: Briefcase,
  calendar: Calendar,
  camera: Camera,
  chartLine: ChartLine,
  check: Check,
  cloud: Cloud,
  code: Code2,
  coffee: Coffee,
  compass: Compass,
  cpu: Cpu,
  crown: Crown,
  database: Database,
  diamond: Diamond,
  feather: Feather,
  fileText: FileText,
  film: Film,
  flame: Flame,
  folder: Folder,
  gamepad: Gamepad2,
  gift: Gift,
  globe: Globe,
  graduationCap: GraduationCap,
  hammer: Hammer,
  headphones: Headphones,
  heart: Heart,
  home: Home,
  image: Image,
  key: Key,
  layers: Layers,
  lightbulb: Lightbulb,
  lock: Lock,
  mail: Mail,
  map: Map,
  megaphone: Megaphone,
  messageSquare: MessageSquare,
  mic: Mic,
  moon: Moon,
  music: Music,
  package: Package,
  palette: Palette,
  pen: Pen,
  pencil: Pencil,
  plane: Plane,
  plug: Plug,
  puzzle: Puzzle,
  rocket: Rocket,
  scale: Scale,
  scissors: Scissors,
  search: Search,
  server: Server,
  settings: Settings,
  shield: Shield,
  ship: Ship,
  shoppingCart: ShoppingCart,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  tag: Tag,
  target: Target,
  terminal: Terminal,
  thumbsUp: ThumbsUp,
  timer: Timer,
  trendingUp: TrendingUp,
  truck: Truck,
  umbrella: Umbrella,
  user: User,
  users: Users,
  video: Video,
  wallet: Wallet,
  wrench: Wrench,
  zap: Zap,
} as const;

export type AgentIconPresetKey = keyof typeof AGENT_ICON_PRESETS;

const DEFAULT_AGENT_ICON_PRESET_KEY: AgentIconPresetKey = "bot";

function orderAgentIconPresetKeys(
  keys: AgentIconPresetKey[],
): AgentIconPresetKey[] {
  const withoutDefault = keys.filter(
    (key) => key !== DEFAULT_AGENT_ICON_PRESET_KEY,
  );
  return [DEFAULT_AGENT_ICON_PRESET_KEY, ...withoutDefault];
}

export const AGENT_ICON_PRESET_KEYS = orderAgentIconPresetKeys(
  Object.keys(AGENT_ICON_PRESETS) as AgentIconPresetKey[],
);

export function isPresetIconKey(value: string): value is AgentIconPresetKey {
  return value in AGENT_ICON_PRESETS;
}

export function isIconUrl(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//")
  );
}

export function formatAgentIconLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function searchAgentIconKeys(query: string): AgentIconPresetKey[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return AGENT_ICON_PRESET_KEYS;
  }

  return AGENT_ICON_PRESET_KEYS.filter((key) => {
    const label = formatAgentIconLabel(key).toLowerCase();
    return key.toLowerCase().includes(normalized) || label.includes(normalized);
  });
}
