import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  buildUpstreamHeaders,
  getEffectivePaymentNetwork,
  resolvePaymentUserTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const ROUTE_PATH = "payment/diff/onchain-state-or-result";
const UPSTREAM_PATH = "/payment/diff/onchain-state-or-result";

const app = createApiApp("/");

app.get("*", async (c) => {
  const request = c.req.raw;
  try {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    requireNetworkedOidcApiScope(authContext, {
      resource: "payments",
      action: "read",
      network: getEffectivePaymentNetwork(request),
    });

    const upstream = await resolvePaymentUserTokenUpstream(authContext.user.id);
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
    if (error instanceof ApiError) throw error;
    rethrowIfAuthOrCreditsError(error);
    console.error(`[External Service Proxy:${ROUTE_PATH}]`, error);
    throw new ApiError(500, "Proxy request failed");
  }
});

export const { GET } = nextHandlers(app);
export default app;
