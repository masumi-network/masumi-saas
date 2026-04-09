/**
 * MIP-004 uses JCS (RFC 8785) for `input_data`. `canonical-json` matches the stack used by
 * masumi-payment-service’s testing UI; changing libraries risks diverging hashes from the
 * payment node without obvious errors—re-check against a known-good hash if you swap deps.
 */
import stringify from "canonical-json";
import LZString from "lz-string";

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

/** cURL for POST /api/v1/purchase via the SaaS proxy (ReadAndPay API key). */
export function generateSaasPurchaseCurl(origin: string, body: object): string {
  const base = origin.replace(/\/$/, "");
  const payload = JSON.stringify(body, null, 2);
  return `curl -X POST "${base}/api/v1/purchase" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_MASUMI_SAAS_API_KEY" \\
  -d '${payload.replace(/'/g, `'\"'\"'`)}'`;
}

function isValidHex(str: string): boolean {
  return /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Decompresses a payment `blockchainIdentifier` (hex) to recover purchaser nonce and related parts.
 * Matches masumi-payment-service frontend testing utils.
 */
export function decodeBlockchainIdentifier(blockchainIdentifier: string): {
  sellerId: string;
  purchaserId: string;
  signature: string;
  key: string;
  agentIdentifier: string | null;
} | null {
  try {
    if (!isValidHex(blockchainIdentifier)) return null;

    const bytes = hexToUint8Array(blockchainIdentifier);
    const decompressed = LZString.decompressFromUint8Array(bytes);

    if (typeof decompressed !== "string") return null;

    const parts = decompressed.split(".");
    if (parts.length !== 4) return null;

    const sellerId = parts[0]!;
    const purchaserId = parts[1]!;
    const signature = parts[2]!;
    const key = parts[3]!;

    if (!isValidHex(sellerId) || !isValidHex(purchaserId)) return null;

    const agentIdentifier = sellerId.length > 64 ? sellerId.slice(64) : null;

    return { sellerId, purchaserId, signature, key, agentIdentifier };
  } catch {
    return null;
  }
}

export type ExtractedPurchasePrefill = {
  blockchainIdentifier?: string;
  sellerVkey?: string;
  inputHash?: string;
  agentIdentifier?: string;
  identifierFromPurchaser?: string;
  payByTime?: string;
  submitResultTime?: string;
  unlockTime?: string;
  externalDisputeUnlockTime?: string;
  metadata?: string;
};

/** Parse pasted Create Payment JSON (raw or wrapped) and map fields for a purchase request. */
export function tryExtractPaymentJsonForPurchase(
  raw: string,
): ExtractedPurchasePrefill | null {
  try {
    let obj: unknown = JSON.parse(raw);
    if (obj && typeof obj === "object" && "data" in obj) {
      const wrap = obj as { data: unknown };
      if (
        wrap.data &&
        typeof wrap.data === "object" &&
        "data" in (wrap.data as object)
      ) {
        obj = (wrap.data as { data: unknown }).data;
      } else {
        obj = wrap.data;
      }
    }
    if (!obj || typeof obj !== "object") return null;
    const o = obj as Record<string, unknown>;
    const fields: ExtractedPurchasePrefill = {};
    if (typeof o.blockchainIdentifier === "string") {
      fields.blockchainIdentifier = o.blockchainIdentifier;
    }
    if (typeof o.agentIdentifier === "string") {
      fields.agentIdentifier = o.agentIdentifier;
    }
    if (typeof o.inputHash === "string") {
      fields.inputHash = o.inputHash;
    }
    const scw = o.SmartContractWallet;
    if (
      scw &&
      typeof scw === "object" &&
      typeof (scw as { walletVkey?: unknown }).walletVkey === "string"
    ) {
      fields.sellerVkey = (scw as { walletVkey: string }).walletVkey;
    }
    for (const k of [
      "payByTime",
      "submitResultTime",
      "unlockTime",
      "externalDisputeUnlockTime",
    ] as const) {
      if (o[k] != null) {
        fields[k] = String(o[k]);
      }
    }
    if (typeof o.metadata === "string" && o.metadata.length > 0) {
      fields.metadata = o.metadata;
    }
    if (fields.blockchainIdentifier) {
      const decoded = decodeBlockchainIdentifier(fields.blockchainIdentifier);
      if (decoded) {
        fields.identifierFromPurchaser = decoded.purchaserId;
      }
    }
    return fields.blockchainIdentifier ? fields : null;
  } catch {
    return null;
  }
}

export function getAgentPricingType(pricing: unknown): string | undefined {
  if (pricing && typeof pricing === "object" && "pricingType" in pricing) {
    const t = (pricing as { pricingType?: unknown }).pricingType;
    return typeof t === "string" ? t : undefined;
  }
  return undefined;
}
