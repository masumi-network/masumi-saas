import { createHash } from "node:crypto";

import stringify from "canonical-json";

import { normalizeInputSchema } from "./input-schema";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashCanonicalJsonValue(value: unknown): string | null {
  try {
    const canonicalJson = stringify(value);
    return canonicalJson === undefined ? null : sha256Hex(canonicalJson);
  } catch {
    return null;
  }
}

export function hashInputData(
  inputData: Record<string, unknown>,
  identifierFromPurchaser: string,
): string {
  return sha256Hex(`${identifierFromPurchaser};${stringify(inputData)}`);
}

export function hashResult(
  result: string,
  identifierFromPurchaser: string,
): string {
  const escaped = JSON.stringify(result).slice(1, -1);
  return sha256Hex(`${identifierFromPurchaser};${escaped}`);
}

export function hashInputSchema(inputSchema: unknown): string | null {
  const normalized = normalizeInputSchema(inputSchema);
  if (!normalized) return null;
  return hashCanonicalJsonValue(normalized);
}
