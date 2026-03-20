/**
 * Payment node API proxy.
 * Forwards a whitelist of payment-node paths only (safer than a blocklist when the API grows).
 * When adding new user-facing routes on the payment node, extend ALLOWED_ROOT_SEGMENTS or
 * SPECIAL_ALLOW rules and align with scripts/specs/payment-node-openapi.json.
 */

import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { paymentNodeConfig } from "@/lib/payment-node/config";
import { decryptPaymentNodeSecret } from "@/lib/payment-node/encryption";
import { createPaymentNodeKeyForUser } from "@/lib/payment-node/on-signup";

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

async function getPaymentNodeToken(userId: string): Promise<string | null> {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { paymentNodeApiKeyEncrypted: true },
  });

  if (!user?.paymentNodeApiKeyEncrypted) {
    await createPaymentNodeKeyForUser(userId);
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { paymentNodeApiKeyEncrypted: true },
    });
  }

  if (!user?.paymentNodeApiKeyEncrypted) return null;
  try {
    return await decryptPaymentNodeSecret(user.paymentNodeApiKeyEncrypted);
  } catch {
    return null;
  }
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
    const pathSegments = pathParam ?? [];
    if (!isAllowedProxyPath(pathSegments)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const token = await getPaymentNodeToken(user.id);
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Payment node not configured for user" },
        { status: 403 },
      );
    }

    const path = pathSegments.join("/");
    const baseUrl = paymentNodeConfig.getBaseUrl();
    const targetUrl = `${baseUrl}/${path}${request.nextUrl.search}`;

    const headers = new Headers();
    headers.set("token", token);
    headers.set("Content-Type", "application/json");
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower !== "authorization" &&
        lower !== "x-api-key" &&
        lower !== "cookie" &&
        lower !== "host"
      ) {
        headers.set(key, value);
      }
    });

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
