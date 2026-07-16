import { NextResponse } from "next/server";

import {
  AGENT_ICON_PRESET_KEYS,
  isPresetIconKey,
} from "@/lib/constants/agent-icons";

const PRESET_COLORS: Record<string, string> = {
  bot: "#6366f1",
  sparkles: "#a855f7",
  zap: "#f59e0b",
  code: "#0ea5e9",
  image: "#ec4899",
  database: "#14b8a6",
  fileText: "#64748b",
  messageSquare: "#22c55e",
  book: "#b45309",
  brain: "#8b5cf6",
  cpu: "#475569",
  globe: "#06b6d4",
  mic: "#ef4444",
  headphones: "#f97316",
  palette: "#d946ef",
  search: "#3b82f6",
  graduationCap: "#10b981",
  briefcase: "#78716c",
  video: "#e11d48",
};

function buildPresetIconSvg(preset: string): string {
  const fill = PRESET_COLORS[preset] ?? "#6366f1";
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
