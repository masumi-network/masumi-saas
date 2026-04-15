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

const UPSTREAM_PATH = "/inbox-agent-registration/";

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const body = await readOptionalRequestBody(request);
    requireNetworkedOidcApiScope(authContext, {
      resource: "inbox-agents",
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
        method: "POST",
        headers,
        body,
      },
    );

    return toUpstreamResponse(response);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("[Registry Discovery:inbox-agent-registrations]", error);
    return NextResponse.json(
      { success: false, error: "Proxy request failed" },
      { status: 500 },
    );
  }
}
