import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { parseNetwork } from "@/lib/schemas/api-query";
import {
  buildUpstreamHeaders,
  readOptionalRequestBody,
  resolveRegistrySharedTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";
import { createApiApp } from "@/server/hono/app";
import { nextHandlers } from "@/server/hono/next";

const ROUTE_PATH = "inbox-agent-registration-search";
const UPSTREAM_PATH = "/inbox-agent-registration-search/";

const app = createApiApp("/");

function getEffectiveInboxSearchNetwork(
  request: NextRequest,
  body: string | undefined,
): "Mainnet" | "Preprod" {
  let networkValue =
    request.nextUrl.searchParams.get("network") ??
    request.cookies.get("payment_network")?.value;

  if (body) {
    try {
      const parsed = JSON.parse(body) as { network?: unknown };
      if (typeof parsed.network === "string") {
        networkValue = parsed.network;
      }
    } catch {
      // Let the upstream endpoint handle malformed JSON bodies.
    }
  }

  return parseNetwork(networkValue);
}

app.post("*", async (c) => {
  const request = new NextRequest(c.req.raw);
  try {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    const body = await readOptionalRequestBody(request);
    requireNetworkedOidcApiScope(authContext, {
      resource: "inbox-agents",
      action: "read",
      network: getEffectiveInboxSearchNetwork(request, body),
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
    return c.json(
      { success: false as const, error: "Proxy request failed" },
      500,
    );
  }
});

export const { POST } = nextHandlers(app);
export default app;
