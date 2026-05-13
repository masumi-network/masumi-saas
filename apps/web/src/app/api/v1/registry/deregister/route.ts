import { NextRequest, NextResponse } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  consumeCreditIfRequired,
  createCreditReference,
} from "@/lib/credits/service";
import {
  buildUpstreamHeaders,
  getEffectivePaymentNetwork,
  readOptionalRequestBody,
  resolvePaymentUserTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";

const ROUTE_PATH = "registry/deregister";
const UPSTREAM_PATH = "/registry/deregister";

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const body = await readOptionalRequestBody(request);
    const network = getEffectivePaymentNetwork(request, body);
    requireNetworkedOidcApiScope(authContext, {
      resource: "registry",
      action: "write",
      network,
    });

    const upstream = await resolvePaymentUserTokenUpstream(authContext.user.id);
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: upstream.error },
        { status: upstream.status },
      );
    }

    // Debit before the first upstream write.
    await consumeCreditIfRequired({
      userId: authContext.user.id,
      reason: "payment_proxy_write",
      reference: createCreditReference("payment-proxy-write"),
      network,
      metadata: {
        method: "POST",
        route: ROUTE_PATH,
        upstreamPath: UPSTREAM_PATH,
        network,
        authMethod: authContext.authMethod,
      },
    });

    const headers = buildUpstreamHeaders(request, upstream.token);
    const response = await fetch(
      `${upstream.baseUrl}${UPSTREAM_PATH}${request.nextUrl.search}`,
      {
        method: "POST",
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
