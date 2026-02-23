import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Code2,
  Cpu,
  Database,
  FileText,
  Globe,
  GraduationCap,
  Headphones,
  Image,
  MessageSquare,
  Mic,
  Palette,
  Search,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";

export const AGENT_ICON_PRESETS: Record<string, LucideIcon> = {
  bot: Bot,
  sparkles: Sparkles,
  zap: Zap,
  code: Code2,
  image: Image,
  database: Database,
  fileText: FileText,
  messageSquare: MessageSquare,
  book: BookOpen,
  brain: Brain,
  cpu: Cpu,
  globe: Globe,
  mic: Mic,
  headphones: Headphones,
  palette: Palette,
  search: Search,
  graduationCap: GraduationCap,
  briefcase: Briefcase,
  video: Video,
} as const;

export type AgentIconPresetKey = keyof typeof AGENT_ICON_PRESETS;

export const AGENT_ICON_PRESET_KEYS = Object.keys(
  AGENT_ICON_PRESETS,
) as AgentIconPresetKey[];

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
