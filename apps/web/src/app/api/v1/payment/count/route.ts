import { NextRequest, NextResponse } from "next/server";

import { rejectOidcAccessTokenAuth } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  consumeCreditOrThrow,
  createCreditReference,
} from "@/lib/credits/service";
import {
  buildUpstreamHeaders,
  readOptionalRequestBody,
  resolvePaymentUserTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";

const ROUTE_PATH = "payment/count";
const UPSTREAM_PATH = "/payment/count";

export async function GET(request: NextRequest) {
  return handleRequest(request, "GET");
}

async function handleRequest(request: NextRequest, method: string) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    rejectOidcAccessTokenAuth(
      authContext,
      "OIDC access tokens are not supported for this /api/v1 endpoint",
    );

    const upstream = await resolvePaymentUserTokenUpstream(authContext.user.id);
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: upstream.error },
        { status: upstream.status },
      );
    }

    if (method !== "GET") {
      await consumeCreditOrThrow({
        userId: authContext.user.id,
        reason: "payment_proxy_write",
        reference: createCreditReference("payment-proxy-write"),
        metadata: {
          method,
          route: ROUTE_PATH,
          upstreamPath: UPSTREAM_PATH,
          network: request.nextUrl.searchParams.get("network"),
          authMethod: authContext.authMethod,
        },
      });
    }

    const headers = buildUpstreamHeaders(request, upstream.token);
    const body =
      method === "GET" ? undefined : await readOptionalRequestBody(request);
    const response = await fetch(
      `${upstream.baseUrl}${UPSTREAM_PATH}${request.nextUrl.search}`,
      {
        method,
        headers,
        body,
      },
    );

    return toUpstreamResponse(response);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error(`[External Service Proxy:${ROUTE_PATH}]`, error);
    return NextResponse.json(
      { success: false, error: "Proxy request failed" },
      { status: 500 },
    );
  }
}
