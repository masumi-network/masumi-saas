import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  buildUpstreamHeaders,
  getEffectivePaymentNetwork,
  readOptionalRequestBody,
  resolveRegistrySharedTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";

const ROUTE_PATH = "registry-entry-search";
const UPSTREAM_PATH = "/registry-entry-search/";

export async function POST(request: NextRequest) {
  return handleRequest(request, "POST");
}

async function handleRequest(request: NextRequest, method: string) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const body =
      method === "GET" ? undefined : await readOptionalRequestBody(request);
    requireNetworkedOidcApiScope(authContext, {
      resource: "registry",
      action: "read",
      network: getEffectivePaymentNetwork(request, body),
    });

    const upstream = resolveRegistrySharedTokenUpstream();
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: upstream.error },
        { status: upstream.status },
      );
    }

    const headers = buildUpstreamHeaders(request, upstream.token);
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
