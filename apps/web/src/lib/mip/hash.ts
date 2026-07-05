import { createHash, createHmac } from "node:crypto";

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
  return sha256Hex(`${identifierFromPurchaser};${result}`);
}

export function hashInputSchema(inputSchema: unknown): string | null {
  const normalized = normalizeInputSchema(inputSchema);
  if (!normalized) return null;
  return hashCanonicalJsonValue(normalized);
}

export function signRuntimeResponse(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const canonicalJson = stringify(payload);
  if (canonicalJson === undefined) {
    throw new Error("Unable to sign non-serializable runtime response");
  }
  return createHmac("sha256", secret).update(canonicalJson).digest("hex");
}
