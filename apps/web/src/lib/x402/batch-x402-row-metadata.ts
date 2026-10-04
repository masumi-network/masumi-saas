import {
  buildMinimalX402ResourceMetadata,
  buildX402ResourceAutofill,
  type X402ProbeRowSnapshot,
} from "@/lib/x402/resource-autofill";

export type BatchX402RowMetadata = {
  name: string;
  description: string;
  tagsText: string;
};

export function parseCommaSeparatedTags(text: string): string[] {
  return text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function mergeTagsToText(...tagLists: string[][]): string {
  const merged = new Set<string>();
  for (const list of tagLists) {
    for (const tag of list) {
      const trimmed = tag.trim();
      if (trimmed) merged.add(trimmed);
    }
  }
  return [...merged].join(", ");
}

export function probeApiRowToSnapshot(
  row: Record<string, unknown>,
  fallbackResourceUrl: string,
): X402ProbeRowSnapshot {
  const resource =
    typeof row.resource === "string"
      ? row.resource
      : typeof row.resourceUrl === "string"
        ? row.resourceUrl
        : fallbackResourceUrl;

  return {
    resource,
    description: typeof row.description === "string" ? row.description : null,
    type: typeof row.type === "string" ? row.type : undefined,
    network: typeof row.network === "string" ? row.network : undefined,
    scheme: typeof row.scheme === "string" ? row.scheme : undefined,
  };
}

export function buildBatchRowMetadataFromProbe(input: {
  resourceUrl: string;
  probeRow: Record<string, unknown>;
  autofillMetadata: boolean;
  extraTagsText: string;
}): BatchX402RowMetadata {
  const snapshot = probeApiRowToSnapshot(input.probeRow, input.resourceUrl);
  const base = input.autofillMetadata
    ? buildX402ResourceAutofill(snapshot)
    : buildMinimalX402ResourceMetadata(input.resourceUrl);
  const extraTags = parseCommaSeparatedTags(input.extraTagsText);

  return {
    name: base.name,
    description: base.description,
    tagsText: mergeTagsToText(base.tags, extraTags),
  };
}

export function batchRowMetadataToTags(
  metadata: BatchX402RowMetadata,
): string[] {
  return parseCommaSeparatedTags(metadata.tagsText);
}
