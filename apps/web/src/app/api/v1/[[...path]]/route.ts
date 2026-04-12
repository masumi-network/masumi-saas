/**
 * Authenticated `/api/v1/*` passthrough proxy.
 * Routes are generated from checked-in upstream OpenAPI specs and mapped to either
 * the Masumi payment service or the Masumi registry service.
 */

import { NextRequest, NextResponse } from "next/server";

import { rejectOidcAccessTokenAuth } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { paymentNodeConfig } from "@/lib/payment-node/config";
import { getPaymentNodeApiKeyTokenForUser } from "@/lib/payment-node/get-user-client";
import { registryServiceConfig } from "@/lib/registry-service";
import {
  type ProxyOperationMethod,
  type ProxyRouteDescriptor,
  getProxyRouteDescriptor,
} from "@/lib/v1-proxy/manifest";
import { normalizeProxyPathSegments } from "@/lib/v1-proxy/path";

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
  method: ProxyOperationMethod,
) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    rejectOidcAccessTokenAuth(
      authContext,
      "OIDC access tokens are not supported for the /api/v1 proxy",
    );
    const { user } = authContext;

    const { path: pathParam } = await params;
    const normalizedPath = normalizeProxyPathSegments(pathParam);
    if (!normalizedPath.ok) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const route = getProxyRouteDescriptor(
      method,
      normalizedPath.normalizedPath,
    );
    if (!route) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const upstreamRequest = await getUpstreamRequest(route, user.id);
    if (!upstreamRequest.ok) {
      return NextResponse.json(
        { success: false, error: upstreamRequest.error },
        { status: upstreamRequest.status },
      );
    }

    const headers = new Headers();
    headers.set("token", upstreamRequest.token);
    headers.set(
      "Content-Type",
      request.headers.get("content-type") ?? "application/json",
    );

    let body: string | undefined;
    if (method !== "GET") {
      try {
        body = await request.text();
      } catch {
        // no body
      }
    }

    const res = await fetch(
      `${upstreamRequest.baseUrl}${route.upstreamPath}${request.nextUrl.search}`,
      {
        method,
        headers,
        body: body || undefined,
      },
    );

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
    console.error("[External Service Proxy]", error);
    return NextResponse.json(
      { success: false, error: "Proxy request failed" },
      { status: 500 },
    );
  }
}

async function getUpstreamRequest(
  route: ProxyRouteDescriptor,
  userId: string,
): Promise<
  | { ok: true; baseUrl: string; token: string }
  | { ok: false; status: number; error: string }
> {
  if (route.authMode === "payment-user-token") {
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
