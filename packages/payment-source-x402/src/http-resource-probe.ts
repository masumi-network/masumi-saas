/**
 * Live HTTP x402 resource probe (402 body or PAYMENT-REQUIRED header).
 * Mirrors base-x402-registry-import/scripts/probe-x402-resource.mjs for SaaS registration.
 */

export const SOKOSUMI_SUPPORTED_SCHEME = "exact" as const;
export const SOKOSUMI_SUPPORTED_TRANSFER_METHOD = "eip3009" as const;

export const USDC_BY_EVM_NETWORK: Record<string, string> = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

const TRUSTED_EIP712_DOMAINS: Record<
  string,
  { name: string; version: string }
> = {
  [`eip155:8453:${USDC_BY_EVM_NETWORK["eip155:8453"]!.toLowerCase()}`]: {
    name: "USD Coin",
    version: "2",
  },
  [`eip155:84532:${USDC_BY_EVM_NETWORK["eip155:84532"]!.toLowerCase()}`]: {
    name: "USDC",
    version: "2",
  },
};

export type X402HttpAccept = {
  network?: string;
  scheme?: string;
  payTo?: string;
  recipient?: string;
  asset?: string;
  amount?: string | number;
  maxAmountRequired?: string | number;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown> | null;
  description?: string | null;
};

export type X402HttpProbeRow = {
  resource: string;
  type: "http" | "mcp";
  description: string | null;
  x402Version: number | null;
  network: string;
  payTo: string;
  asset: string;
  scheme: string;
  amount: string | null;
  decimals: number;
  maxTimeoutSeconds: number | null;
  extra: Record<string, unknown> | null;
  sokosumiCompatible: boolean;
  probedAt: string;
};

export type SokosumiCompatibilityResult = {
  compatible: boolean;
  checks: {
    schemeExact: boolean;
    transferMethodEip3009OrAbsent: boolean;
    trustedEip712Domain: boolean;
    samePairEntriesAgree: boolean;
    hasTimeoutWindow: boolean;
  };
};

function tryParseJson(text: string): unknown | null {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** x402 v2 sends PAYMENT-REQUIRED as base64 JSON; v1 servers may send raw JSON. */
export function parsePaymentRequiredHeader(
  header: string | null | undefined,
): unknown | null {
  if (!header) return null;
  const raw = tryParseJson(header);
  if (raw) return raw;
  try {
    return tryParseJson(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function hasAccepts(doc: unknown): boolean {
  if (doc == null || typeof doc !== "object") return false;
  const record = doc as Record<string, unknown>;
  return (
    Array.isArray(record.accepts) || Array.isArray(record.paymentRequirements)
  );
}

function pickNetworkAccept(
  accepts: X402HttpAccept[],
  network: string,
): X402HttpAccept | null {
  const onNetwork = accepts.filter((a) => a?.network === network);
  if (onNetwork.length === 0) return null;
  return (
    onNetwork.find((a) => a.scheme === SOKOSUMI_SUPPORTED_SCHEME) ??
    onNetwork[0] ??
    null
  );
}

export function assessSokosumiBuySideCompatibility(
  accepts: X402HttpAccept[],
  accept: X402HttpAccept,
): SokosumiCompatibilityResult {
  const network = (accept.network ?? "").toLowerCase();
  const asset = (accept.asset ?? "").toLowerCase();
  const payTo = (accept.payTo ?? accept.recipient ?? "").toLowerCase();
  const transferMethod =
    typeof accept.extra?.assetTransferMethod === "string"
      ? accept.extra.assetTransferMethod
      : null;
  const trusted = TRUSTED_EIP712_DOMAINS[`${network}:${asset}`] ?? null;

  const samePair = accepts.filter(
    (c) =>
      (c?.network ?? "").toLowerCase() === network &&
      (c?.asset ?? "").toLowerCase() === asset,
  );
  const samePairAgree = samePair.every(
    (c) =>
      (c.payTo ?? c.recipient ?? "").toLowerCase() === payTo &&
      String(c.amount ?? c.maxAmountRequired) ===
        String(accept.amount ?? accept.maxAmountRequired),
  );

  const checks = {
    schemeExact: accept.scheme === SOKOSUMI_SUPPORTED_SCHEME,
    transferMethodEip3009OrAbsent:
      transferMethod === null ||
      transferMethod === SOKOSUMI_SUPPORTED_TRANSFER_METHOD,
    trustedEip712Domain:
      trusted !== null &&
      accept.extra?.name === trusted.name &&
      accept.extra?.version === trusted.version,
    samePairEntriesAgree: samePairAgree,
    hasTimeoutWindow: Number.isFinite(Number(accept.maxTimeoutSeconds)),
  };

  return {
    compatible: Object.values(checks).every(Boolean),
    checks,
  };
}

function inferDecimals(network: string, assetLower: string): number {
  const usdc = USDC_BY_EVM_NETWORK[network]?.toLowerCase();
  if (usdc && assetLower === usdc) return 6;
  return 6;
}

export type ProbeX402HttpResourceOptions = {
  resourceUrl: string;
  evmNetwork: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type ProbeX402HttpResourceResult =
  | {
      ok: true;
      row: X402HttpProbeRow;
      compatibility: SokosumiCompatibilityResult;
    }
  | {
      ok: false;
      error: string;
      httpStatus?: number;
    };

/**
 * GET the resource URL without payment; require 402 (or JSON with accepts).
 */
export async function probeX402HttpResource(
  options: ProbeX402HttpResourceOptions,
): Promise<ProbeX402HttpResourceResult> {
  const { resourceUrl, evmNetwork } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;

  let parsed: URL;
  try {
    parsed = new URL(resourceUrl);
  } catch {
    return { ok: false, error: "Resource URL must be a valid HTTPS URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Resource URL must use http or https." };
  }

  let res: Response;
  try {
    res = await fetchImpl(parsed.href, {
      method: "GET",
      headers: { accept: "*/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach resource URL.";
    return { ok: false, error: message };
  }

  const paymentHeader =
    res.headers.get("payment-required") ?? res.headers.get("PAYMENT-REQUIRED");
  const body = await res.text();
  const bodyDoc = tryParseJson(body);
  const headerDoc = parsePaymentRequiredHeader(paymentHeader);
  const doc = hasAccepts(bodyDoc)
    ? bodyDoc
    : hasAccepts(headerDoc)
      ? headerDoc
      : (bodyDoc ?? headerDoc);

  if (res.status !== 402 && !hasAccepts(doc)) {
    return {
      ok: false,
      error: `Expected HTTP 402 with payment requirements; got ${res.status}.`,
      httpStatus: res.status,
    };
  }

  const record = (doc ?? {}) as Record<string, unknown>;
  const accepts = (
    Array.isArray(record.accepts)
      ? record.accepts
      : Array.isArray(record.paymentRequirements)
        ? record.paymentRequirements
        : []
  ) as X402HttpAccept[];

  const accept = pickNetworkAccept(accepts, evmNetwork);
  if (!accept) {
    return {
      ok: false,
      error: `No payment accept for network ${evmNetwork} on this resource.`,
      httpStatus: res.status,
    };
  }

  const amountRaw = accept.amount ?? accept.maxAmountRequired ?? null;
  const amount = amountRaw != null ? String(amountRaw) : null;
  if (!amount) {
    return {
      ok: false,
      error:
        "Live 402 has no fixed amount; dynamic pricing is not supported in this flow yet.",
      httpStatus: res.status,
    };
  }

  const asset = (accept.asset ?? "").toLowerCase();
  const payTo = (accept.payTo ?? accept.recipient ?? "").toLowerCase();
  const decimals = inferDecimals(evmNetwork, asset);
  const compatibility = assessSokosumiBuySideCompatibility(accepts, accept);

  const resourceField = record.resource;
  let description: string | null = null;
  if (typeof accept.description === "string") {
    description = accept.description;
  } else if (
    resourceField != null &&
    typeof resourceField === "object" &&
    typeof (resourceField as { description?: string }).description === "string"
  ) {
    description = (resourceField as { description: string }).description;
  }

  const row: X402HttpProbeRow = {
    resource: parsed.href,
    type: "http",
    description,
    x402Version:
      typeof record.x402Version === "number" ? record.x402Version : null,
    network: evmNetwork,
    payTo,
    asset,
    scheme: accept.scheme ?? SOKOSUMI_SUPPORTED_SCHEME,
    amount,
    decimals,
    maxTimeoutSeconds: accept.maxTimeoutSeconds ?? null,
    extra: accept.extra ?? null,
    sokosumiCompatible: compatibility.compatible,
    probedAt: new Date().toISOString(),
  };

  if (!compatibility.compatible) {
    return {
      ok: false,
      error:
        "This resource is not Sokosumi-compatible (scheme, transfer method, USDC domain, or conflicting accepts).",
      httpStatus: res.status,
    };
  }

  return { ok: true, row, compatibility };
}
