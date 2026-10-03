import { MAX_BATCH_RESOURCE_URLS } from "./parse-batch-resource-urls";

const RESOURCE_URL_KEYS = [
  "resource",
  "resourceUrl",
  "url",
  "href",
  "apiUrl",
] as const;

const NESTED_COLLECTION_KEYS = [
  "resources",
  "items",
  "urls",
  "endpoints",
] as const;

export type ParseBatchResourceUrlsFromJsonResult = {
  urls: string[];
  invalidEntries: string[];
  truncated: boolean;
  parseError?: "invalid_json";
};

function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function collectFromJsonNode(
  node: unknown,
  depth: number,
  out: string[],
  invalidEntries: string[],
): void {
  if (depth > 16 || out.length > MAX_BATCH_RESOURCE_URLS * 20) {
    return;
  }

  if (typeof node === "string") {
    if (/^https?:\/\//i.test(node)) {
      const href = normalizeHttpUrl(node);
      if (href) out.push(href);
      else invalidEntries.push(node);
    }
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectFromJsonNode(item, depth + 1, out, invalidEntries);
    }
    return;
  }

  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  for (const key of RESOURCE_URL_KEYS) {
    const value = record[key];
    if (typeof value === "string") {
      const href = normalizeHttpUrl(value);
      if (href) out.push(href);
      else invalidEntries.push(value);
    }
  }

  for (const key of NESTED_COLLECTION_KEYS) {
    if (key in record) {
      collectFromJsonNode(record[key], depth + 1, out, invalidEntries);
    }
  }
}

export function parseBatchResourceUrlsFromJson(
  jsonText: string,
): ParseBatchResourceUrlsFromJsonResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return {
      urls: [],
      invalidEntries: [],
      truncated: false,
      parseError: "invalid_json",
    };
  }

  const rawUrls: string[] = [];
  const invalidEntries: string[] = [];
  collectFromJsonNode(data, 0, rawUrls, invalidEntries);

  const urls: string[] = [];
  const seen = new Set<string>();
  let uniqueTotal = 0;

  for (const href of rawUrls) {
    const key = href.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueTotal += 1;
    if (urls.length < MAX_BATCH_RESOURCE_URLS) {
      urls.push(href);
    }
  }

  return {
    urls,
    invalidEntries,
    truncated: uniqueTotal > MAX_BATCH_RESOURCE_URLS,
  };
}
