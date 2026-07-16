import { appConfig } from "@/lib/config/app.config";
import {
  type AgentIconPresetKey,
  isIconUrl,
  isPresetIconKey,
} from "@/lib/constants/agent-icons";

const MAX_REGISTRY_IMAGE_LENGTH = 250;

function normalizeIconUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return trimmed;
}

export function resolvePresetAgentIconUrl(preset: AgentIconPresetKey): string {
  const base = appConfig.appUrl.replace(/\/$/, "");
  return `${base}/agent-icons/${preset}`;
}

export function resolveAgentRegistryImage(
  icon: string | null | undefined,
): string | undefined {
  if (!icon?.trim()) {
    return undefined;
  }

  const trimmed = icon.trim();

  if (isIconUrl(trimmed)) {
    const url = normalizeIconUrl(trimmed);
    if (url.length > MAX_REGISTRY_IMAGE_LENGTH) {
      return url.slice(0, MAX_REGISTRY_IMAGE_LENGTH);
    }
    return url;
  }

  if (isPresetIconKey(trimmed)) {
    const url = resolvePresetAgentIconUrl(trimmed);
    if (url.length > MAX_REGISTRY_IMAGE_LENGTH) {
      return undefined;
    }
    return url;
  }

  return undefined;
}
