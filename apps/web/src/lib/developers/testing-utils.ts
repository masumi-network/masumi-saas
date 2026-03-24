import stringify from "canonical-json";

export function extractErrorMessage(
  error: unknown,
  fallback: string = "An error occurred",
): string {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    const err = error as Record<string, unknown>;

    if (typeof err.message === "string") return err.message;
    if (typeof err.error === "string") return err.error;
    if (typeof err.statusText === "string") return err.statusText;

    if (err.data && typeof err.data === "object") {
      const data = err.data as Record<string, unknown>;
      if (typeof data.message === "string") return data.message;
      if (typeof data.error === "string") return data.error;
    }

    try {
      const stringified = JSON.stringify(error);
      if (stringified && stringified !== "{}") {
        return stringified.length > 200
          ? stringified.substring(0, 200) + "..."
          : stringified;
      }
    } catch {
      /* ignore */
    }
  }

  return fallback;
}

/** Random hex for `identifierFromPurchaser`. `length` is the number of hex characters (must be even). */
export function generateRandomHex(length: number = 16): string {
  const array = new Uint8Array(length / 2);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateSHA256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** MIP-004: SHA256(identifierFromPurchaser + ";" + JCS(input_data)) */
export async function generateMIP004InputHash(
  inputData: Record<string, unknown>,
  identifierFromPurchaser: string,
): Promise<string> {
  const canonicalJson = stringify(inputData);
  const preImage = identifierFromPurchaser + ";" + canonicalJson;
  return generateSHA256Hex(preImage);
}

export function calculateDefaultTimes() {
  const now = Date.now();
  const payByTime = new Date(now + 60 * 60 * 1000);
  const submitResultTime = new Date(now + 6 * 60 * 60 * 1000);
  const unlockTime = new Date(now + 12 * 60 * 60 * 1000);
  const externalDisputeUnlockTime = new Date(now + 18 * 60 * 60 * 1000);
  return { payByTime, submitResultTime, unlockTime, externalDisputeUnlockTime };
}

/** cURL for calling the SaaS payment-node proxy (use ReadAndPay API key). */
export function generateSaasPaymentCurl(origin: string, body: object): string {
  const base = origin.replace(/\/$/, "");
  const payload = JSON.stringify(body, null, 2);
  return `curl -X POST "${base}/api/v1/payment" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_MASUMI_SAAS_API_KEY" \\
  -d '${payload.replace(/'/g, `'\"'\"'`)}'`;
}

export function getAgentPricingType(pricing: unknown): string | undefined {
  if (pricing && typeof pricing === "object" && "pricingType" in pricing) {
    const t = (pricing as { pricingType?: unknown }).pricingType;
    return typeof t === "string" ? t : undefined;
  }
  return undefined;
}
