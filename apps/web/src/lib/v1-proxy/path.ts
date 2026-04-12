export type ProxyPathNormalizationResult =
  | { ok: true; normalizedPath: string }
  | { ok: false; error: string };

const API_V1_PREFIX = "/api/v1";

function decodeProxySegment(segment: string): string {
  if (!segment.includes("%")) return segment;
  return decodeURIComponent(segment);
}

function normalizeSegments(segments: string[]): ProxyPathNormalizationResult {
  const normalizedSegments: string[] = [];

  for (const rawSegment of segments) {
    if (rawSegment.length === 0) {
      return { ok: false, error: "Empty path segment" };
    }

    let segment: string;
    try {
      segment = decodeProxySegment(rawSegment);
    } catch {
      return { ok: false, error: "Malformed path segment" };
    }

    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\") ||
      segment.includes("\0")
    ) {
      return { ok: false, error: "Forbidden path segment" };
    }

    normalizedSegments.push(segment);
  }

  return { ok: true, normalizedPath: normalizedSegments.join("/") };
}

export function normalizeProxyPathSegments(
  pathSegments?: string[],
): ProxyPathNormalizationResult {
  return normalizeSegments(pathSegments ?? []);
}

export function normalizeProxyPathname(
  pathname: string,
): ProxyPathNormalizationResult {
  if (pathname === API_V1_PREFIX || pathname === `${API_V1_PREFIX}/`) {
    return { ok: true, normalizedPath: "" };
  }

  if (!pathname.startsWith(`${API_V1_PREFIX}/`)) {
    return { ok: false, error: "Not an /api/v1 path" };
  }

  return normalizeSegments(pathname.slice(API_V1_PREFIX.length + 1).split("/"));
}

export function hasUnsafeEncodedProxyPath(rawUrl: string): boolean {
  const lower = rawUrl.toLowerCase();
  if (!lower.includes("/api/v1/")) return false;

  return (
    lower.includes("%2e") || lower.includes("%2f") || lower.includes("%5c")
  );
}
