/**
 * Payment node API proxy.
 * Forwards a whitelist of payment-node paths only (safer than a blocklist when the API grows).
 * When adding new user-facing routes on the payment node, extend ALLOWED_ROOT_SEGMENTS or
 * SPECIAL_ALLOW rules and align with scripts/specs/payment-node-openapi.json.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { paymentNodeConfig } from "@/lib/payment-node/config";
import { getPaymentNodeApiKeyTokenForUser } from "@/lib/payment-node/get-user-client";

/** First path segment under /api/v1 — entire subtree allowed unless SPECIAL_DENY matches. */
const ALLOWED_ROOT_SEGMENTS = new Set([
  "api-key-status",
  "health",
  "invoice",
  "payment",
  "payment-source",
  "purchase",
  "registry",
  "signature",
  "webhooks",
]);

/**
 * Subpaths that must not be proxied even when the root is allowed.
 * Keys are path prefixes (no leading slash).
 */
const SPECIAL_DENY_PREFIXES = ["registry/wallet"] as const;

/**
 * Decode segments, reject `.` / `..` (incl. %2e%2e), and resolve `..` so fetch() URL
 * normalization cannot bypass the whitelist (e.g. payment/%2e%2e/wallet → wallet).
 */
function canonicalizeProxyPathSegments(
  pathSegments: string[],
): string[] | null {
  const stack: string[] = [];
  for (const raw of pathSegments) {
    let segment: string;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return stack.length === 0 ? null : stack;
}

/** Expects already-canonical segments (see canonicalizeProxyPathSegments). */
function isAllowedProxyPath(pathSegments: string[]): boolean {
  if (pathSegments.length === 0) return false;
  const path = pathSegments.join("/");
  for (const deny of SPECIAL_DENY_PREFIXES) {
    if (path === deny || path.startsWith(`${deny}/`)) return false;
  }

  const first = pathSegments[0];
  if (!ALLOWED_ROOT_SEGMENTS.has(first)) return false;

  if (first === "invoice") {
    if (pathSegments[1] !== "monthly") return false;
    if (pathSegments[2] === "internal") return false;
    return true;
  }

  return true;
}

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
    const { user } = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

    const { path: pathParam } = await params;
    const rawSegments = pathParam ?? [];
    const canonical = canonicalizeProxyPathSegments(rawSegments);
    if (canonical === null || !isAllowedProxyPath(canonical)) {
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

    const path = canonical.join("/");
    const baseUrl = paymentNodeConfig.getBaseUrl();
    const targetUrl = `${baseUrl}/${path}${request.nextUrl.search}`;

    const headers = new Headers();
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower !== "authorization" &&
        lower !== "x-api-key" &&
        lower !== "cookie" &&
        lower !== "host" &&
        lower !== "token"
      ) {
        headers.set(key, value);
      }
    });
    // After copying: payment node auth must come from the session user only (never client token).
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
