/**
 * Legacy HTTP fallback for agents registered before IPFS preset icons.
 * New registrations use ipfs:// URLs from agent-icon-ipfs.generated.ts.
 */
import { NextResponse } from "next/server";

import {
  AGENT_ICON_PRESET_KEYS,
  isPresetIconKey,
} from "@/lib/constants/agent-icons";

const PRESET_PALETTE = [
  "#6366f1",
  "#a855f7",
  "#f59e0b",
  "#0ea5e9",
  "#ec4899",
  "#14b8a6",
  "#22c55e",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#e11d48",
  "#78716c",
];

function presetColor(preset: string): string {
  let hash = 0;
  for (let i = 0; i < preset.length; i += 1) {
    hash = (hash * 31 + preset.charCodeAt(i)) >>> 0;
  }
  return PRESET_PALETTE[hash % PRESET_PALETTE.length] ?? "#6366f1";
}

function buildPresetIconSvg(preset: string): string {
  const fill = presetColor(preset);
  const label = preset.slice(0, 2).toUpperCase();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${preset}">
  <rect width="64" height="64" rx="14" fill="${fill}" />
  <text x="32" y="38" text-anchor="middle" fill="#ffffff" font-size="20" font-family="system-ui, sans-serif" font-weight="600">${label}</text>
</svg>`;
}

export function generateStaticParams() {
  return AGENT_ICON_PRESET_KEYS.map((preset) => ({ preset }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ preset: string }> },
) {
  const { preset } = await context.params;
  if (!isPresetIconKey(preset)) {
    return NextResponse.json({ error: "Unknown icon preset" }, { status: 404 });
  }

  return new NextResponse(buildPresetIconSvg(preset), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
