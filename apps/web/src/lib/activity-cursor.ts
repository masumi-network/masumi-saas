import type { ActivityFeedItem } from "@/lib/types/activity";

/** Returned with HTTP 410 when `cursor` decodes but no longer matches the merged feed. */
export const ACTIVITY_STALE_CURSOR_CODE = "STALE_CURSOR" as const;

/** Opaque cursor for GET /api/activity paginated responses (merged feed order). */
export function encodeActivityCursor(item: ActivityFeedItem): string {
  return Buffer.from(
    JSON.stringify({ d: item.date, k: item.kind, i: item.id }),
  ).toString("base64url");
}

export function decodeActivityCursor(s: string): {
  d: string;
  k: ActivityFeedItem["kind"];
  i: string;
} | null {
  try {
    const raw = Buffer.from(s, "base64url").toString("utf8");
    const j = JSON.parse(raw) as { d?: unknown; k?: unknown; i?: unknown };
    if (
      typeof j.d === "string" &&
      (j.k === "lifecycle" || j.k === "transaction") &&
      typeof j.i === "string"
    ) {
      return { d: j.d, k: j.k, i: j.i };
    }
  } catch {
    /* invalid cursor */
  }
  return null;
}
