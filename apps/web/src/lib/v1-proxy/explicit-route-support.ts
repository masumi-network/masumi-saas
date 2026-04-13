import { NextRequest, NextResponse } from "next/server";

import { paymentNodeConfig } from "@/lib/payment-node/config";
import { getPaymentNodeApiKeyTokenForUser } from "@/lib/payment-node/get-user-client";
import { registryServiceConfig } from "@/lib/registry-service";
import { parseNetwork } from "@/lib/schemas/api-query";

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

export function buildUpstreamHeaders(
  request: NextRequest,
  token: string,
): Headers {
  const headers = new Headers();
  headers.set("token", token);
  headers.set(
    "Content-Type",
    request.headers.get("content-type") ?? "application/json",
  );
  return headers;
}

export async function readOptionalRequestBody(
  request: NextRequest,
): Promise<string | undefined> {
  try {
    const body = await request.text();
    return body || undefined;
  } catch {
    return undefined;
  }
}

export function getEffectivePaymentNetwork(
  request: NextRequest,
): "Mainnet" | "Preprod" {
  return parseNetwork(
    request.nextUrl.searchParams.get("network") ??
      request.cookies.get("payment_network")?.value,
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
