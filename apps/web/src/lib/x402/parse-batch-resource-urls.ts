import { resourceUrlDuplicateKey } from "./resource-url-duplicate-key";

const MAX_BATCH_RESOURCE_URLS = 100;

export function parseBatchResourceUrlsInput(text: string): {
  urls: string[];
  invalidLines: string[];
} {
  const urls: string[] = [];
  const invalidLines: string[] = [];
  const seen = new Set<string>();

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const parts = line.split(/[\s,;\t]+/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (urls.length >= MAX_BATCH_RESOURCE_URLS) break;

      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          invalidLines.push(trimmed);
          continue;
        }
        const key = resourceUrlDuplicateKey(parsed.href)!;
        if (seen.has(key)) continue;
        seen.add(key);
        urls.push(parsed.href);
      } catch {
        invalidLines.push(trimmed);
      }
    }
    if (urls.length >= MAX_BATCH_RESOURCE_URLS) break;
  }

  return { urls, invalidLines };
}

/** True when the field clearly lists more than one resource (even if the second URL is still incomplete). */
export function hasMultipleX402ResourceUrlsInInput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const { urls } = parseBatchResourceUrlsInput(trimmed);
  if (urls.length >= 2) return true;
  const schemes = trimmed.match(/https?:\/\//gi);
  return (schemes?.length ?? 0) >= 2;
}

export { MAX_BATCH_RESOURCE_URLS };
