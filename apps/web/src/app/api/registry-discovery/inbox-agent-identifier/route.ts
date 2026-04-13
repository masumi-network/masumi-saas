import { NextRequest, NextResponse } from "next/server";

import { rejectOidcAccessTokenAuth } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  buildUpstreamHeaders,
  resolvePaymentUserTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";

const UPSTREAM_PATH = "/registry-inbox/agent-identifier";

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    rejectOidcAccessTokenAuth(
      authContext,
      "OIDC access tokens are not supported for this inbox lookup endpoint",
    );

    const upstream = await resolvePaymentUserTokenUpstream(authContext.user.id);
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
        method: "GET",
        headers,
      },
    );

    return toUpstreamResponse(response);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("[Registry Discovery:inbox-agent-identifier]", error);
    return NextResponse.json(
      { success: false, error: "Proxy request failed" },
      { status: 500 },
    );
  }
}
