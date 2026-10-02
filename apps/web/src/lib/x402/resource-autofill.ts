import {
  type AgentIconPresetKey,
  isPresetIconKey,
} from "@/lib/constants/agent-icons";

export const DEFAULT_X402_AUTOFILL_ICON = "bot" satisfies AgentIconPresetKey;

export type X402ProbeRowSnapshot = {
  resource: string;
  description?: string | null;
  type?: string;
  network?: string;
  scheme?: string;
};

function titleCaseSegment(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function suggestedNameFromResourceUrl(resourceUrl: string): string {
  try {
    const url = new URL(resourceUrl);
    const host = url.hostname.replace(/^www\./i, "");
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      const label = titleCaseSegment(last.replace(/\.[a-z0-9]+$/i, ""));
      const combined = `${host} · ${label}`;
      return combined.length <= 80 ? combined : combined.slice(0, 80);
    }
    return host.length <= 80 ? host : host.slice(0, 80);
  } catch {
    return "x402 HTTP resource";
  }
}

export function buildX402ResourceAutofill(row: X402ProbeRowSnapshot): {
  name: string;
  description: string;
  tags: string[];
} {
  const name = suggestedNameFromResourceUrl(row.resource);
  const descriptionRaw =
    typeof row.description === "string" ? row.description.trim() : "";
  const description = (
    descriptionRaw || `Paid HTTP x402 resource at ${row.resource}.`
  ).slice(0, 250);

  const tags = new Set<string>(["x402"]);
  if (row.type === "http" || row.type === "mcp") {
    tags.add(row.type);
  } else {
    tags.add("http");
  }
  if (row.scheme?.trim()) {
    tags.add(row.scheme.trim().toLowerCase());
  }
  if (row.network?.includes("84532")) {
    tags.add("testnet");
  } else if (row.network?.includes("8453")) {
    tags.add("base");
  }

  return {
    name,
    description,
    tags: [...tags].slice(0, 8),
  };
}

/** Preset-only icon for x402 autofill (never external URLs). */
export function resolveX402AutofillPresetIcon(
  _row: X402ProbeRowSnapshot,
): AgentIconPresetKey {
  return DEFAULT_X402_AUTOFILL_ICON;
}

export function coerceToAgentIconPreset(value: string): AgentIconPresetKey {
  return isPresetIconKey(value) ? value : DEFAULT_X402_AUTOFILL_ICON;
}
