/**
 * Payment node API proxy.
 * Forwards non-admin, non-wallet-export endpoints to the payment node with the user's API key.
 * Excludes: wallet, payment-source-extended, api-key (CRUD), swap, monitoring, rpc-api-keys, invoice/monthly/internal.
 */

import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { paymentNodeConfig } from "@/lib/payment-node/config";
import { decryptPaymentNodeSecret } from "@/lib/payment-node/encryption";
import { createPaymentNodeKeyForUser } from "@/lib/payment-node/on-signup";

const BLOCKED_PREFIXES = [
  "wallet",
  "payment-source-extended",
  "swap",
  "monitoring",
  "rpc-api-keys",
  "utxos",
] as const;

function isBlockedPath(pathSegments: string[]): boolean {
  if (pathSegments.length === 0) return true;
  const first = pathSegments[0];
  if (BLOCKED_PREFIXES.includes(first as (typeof BLOCKED_PREFIXES)[number]))
    return true;
  if (first === "registry" && pathSegments[1] === "wallet") return true;
  if (first === "api-key" && pathSegments.length > 1) return true; // api-key-status is api-key-status (single segment)
  if (first === "api-key") return true; // api-key CRUD is admin
  if (
    first === "invoice" &&
    pathSegments[1] === "monthly" &&
    pathSegments[2] === "internal"
  )
    return true;
  return false;
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
    if (isBlockedPath(pathSegments)) {
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
