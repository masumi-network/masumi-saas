/**
 * Payment node API proxy.
 * Exact path allowlist only — if `path` is not in the set, 403 (no fetch).
 * When the payment node adds routes, add strings here — keep in sync with
 * scripts/specs/payment-node-openapi.json (omit admin/sensitive paths).
 */

import { NextRequest, NextResponse } from "next/server";

import { rejectOidcAccessTokenAuth } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { paymentNodeConfig } from "@/lib/payment-node/config";
import { getPaymentNodeApiKeyTokenForUser } from "@/lib/payment-node/get-user-client";

/** Full path under /api/v1 (no leading slash). Must match exactly. */
const ALLOWED_PROXY_PATHS = new Set<string>([
  "api-key-status",
  "health",
  "invoice/monthly",
  "invoice/monthly/missing",
  "payment",
  "payment-source",
  "payment/authorize-refund",
  "payment/count",
  "payment/diff",
  "payment/diff/next-action",
  "payment/diff/onchain-state-or-result",
  "payment/error-state-recovery",
  "payment/income",
  "payment/resolve-blockchain-identifier",
  "payment/submit-result",
  "purchase",
  "purchase/cancel-refund-request",
  "purchase/count",
  "purchase/diff",
  "purchase/diff/next-action",
  "purchase/diff/onchain-state-or-result",
  "purchase/error-state-recovery",
  "purchase/request-refund",
  "purchase/resolve-blockchain-identifier",
  "purchase/spending",
  "registry",
  "registry/agent-identifier",
  "registry/count",
  "registry/deregister",
  "registry/diff",
  "signature/sign/create-invoice/monthly",
  "signature/verify/reveal-data",
  "webhooks",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, params, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, params, "POST");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, params, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, params, "DELETE");
}

async function proxyRequest(
  request: NextRequest,
  params: Promise<{ path?: string[] }>,
  method: string,
) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    rejectOidcAccessTokenAuth(
      authContext,
      "OIDC access tokens are not supported for the payment-node proxy",
    );
    const { user } = authContext;

    const { path: pathParam } = await params;
    const path = (pathParam ?? []).join("/");
    if (!ALLOWED_PROXY_PATHS.has(path)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const token = await getPaymentNodeApiKeyTokenForUser(user.id);
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Payment node not configured for user" },
        { status: 403 },
      );
    }
    const baseUrl = paymentNodeConfig.getBaseUrl();
    const targetUrl = `${baseUrl}/${path}${request.nextUrl.search}`;

    // Only headers the payment node needs — do not forward arbitrary client headers.
    const headers = new Headers();
    headers.set("token", token);
    headers.set("Content-Type", "application/json");

    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await request.text();
      } catch {
        // no body
      }
    }

    const res = await fetch(targetUrl, {
      method,
      headers,
      body: body || undefined,
    });

    const responseBody = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(responseBody);
    } catch {
      return new NextResponse(responseBody, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "text/plain",
        },
      });
    }

    return NextResponse.json(json, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("[Payment Node Proxy]", error);
    return NextResponse.json(
      { success: false, error: "Proxy request failed" },
      { status: 500 },
    );
  }
}
