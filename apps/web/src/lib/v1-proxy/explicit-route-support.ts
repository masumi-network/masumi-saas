import { NextResponse } from "next/server";

import { paymentNodeConfig } from "@/lib/payment-node/config";
import { getPaymentNodeApiKeyTokenForUser } from "@/lib/payment-node/get-user-client";
import { registryServiceConfig } from "@/lib/registry-service";
import { parseNetwork } from "@/lib/schemas/api-query";

/**
 * Read a cookie value from a raw `Request`. Avoids depending on the
 * `NextRequest.cookies` API so these helpers work with the underlying Web
 * Request that Hono hands us (`c.req.raw`).
 *
 * Wrapping the Hono request in `new NextRequest(...)` throws on Next 16
 * (`Cannot read private member #state ...`), which is why we read the raw
 * Cookie header instead.
 */
function readCookieFromRequest(
  request: Request,
  name: string,
): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    if (key !== name) continue;
    const value = trimmed.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

export type UpstreamResolution =
  | {
      ok: true;
      baseUrl: string;
      token: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function resolvePaymentUserTokenUpstream(
  userId: string,
): Promise<UpstreamResolution> {
  const token = await getPaymentNodeApiKeyTokenForUser(userId);
  if (!token) {
    return {
      ok: false,
      status: 403,
      error: "Payment node not configured for user",
    };
  }

  try {
    return {
      ok: true,
      baseUrl: paymentNodeConfig.getBaseUrl(),
      token,
    };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Payment service is not configured",
    };
  }
}

export function resolveRegistrySharedTokenUpstream(): UpstreamResolution {
  try {
    return {
      ok: true,
      baseUrl: registryServiceConfig.getBaseUrl(),
      token: registryServiceConfig.getApiKey(),
    };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Registry service is not configured",
    };
  }
}

export function buildUpstreamHeaders(request: Request, token: string): Headers {
  const headers = new Headers();
  headers.set("token", token);
  headers.set(
    "Content-Type",
    request.headers.get("content-type") ?? "application/json",
  );
  return headers;
}

export async function readOptionalRequestBody(
  request: Request,
): Promise<string | undefined> {
  try {
    const body = await request.text();
    return body || undefined;
  } catch {
    return undefined;
  }
}

function extractNetworkFromBody(body: string | undefined): string | undefined {
  if (!body) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as { network?: unknown };
    return typeof parsed.network === "string" ? parsed.network : undefined;
  } catch {
    return undefined;
  }
}

export function getEffectivePaymentNetwork(
  request: Request,
  body?: string,
): "Mainnet" | "Preprod" {
  const url = new URL(request.url);
  return parseNetwork(
    extractNetworkFromBody(body) ??
      url.searchParams.get("network") ??
      readCookieFromRequest(request, "payment_network"),
  );
}

export async function toUpstreamResponse(response: Response) {
  const responseBody = await response.text();

  let json: unknown;
  try {
    json = JSON.parse(responseBody);
  } catch {
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "text/plain",
      },
    });
  }

  return NextResponse.json(json, {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
