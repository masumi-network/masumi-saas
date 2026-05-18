import { NextRequest } from "next/server";

import { requireAllNetworkedOidcApiScopes } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  buildUpstreamHeaders,
  resolveRegistrySharedTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";
import { createApiApp } from "@/server/hono/app";
import { nextHandlers } from "@/server/hono/next";

const ROUTE_PATH = "payment-information";
const UPSTREAM_PATH = "/payment-information/";

const app = createApiApp("/");

app.get("*", async (c) => {
  const request = new NextRequest(c.req.raw);
  try {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    requireAllNetworkedOidcApiScopes(authContext, {
      resource: "registry",
      action: "read",
    });

    const upstream = resolveRegistrySharedTokenUpstream();
    if (!upstream.ok) {
      return c.json(
        { success: false as const, error: upstream.error },
        upstream.status as never,
      );
    }

    const headers = buildUpstreamHeaders(request, upstream.token);
    const response = await fetch(
      `${upstream.baseUrl}${UPSTREAM_PATH}${new URL(c.req.url).search}`,
      {
        method: "GET",
        headers,
      },
    );

    return toUpstreamResponse(response);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error(`[External Service Proxy:${ROUTE_PATH}]`, error);
    return c.json(
      { success: false as const, error: "Proxy request failed" },
      500,
    );
  }
});

export const { GET } = nextHandlers(app);
export default app;
