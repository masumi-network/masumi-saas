import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  buildUpstreamHeaders,
  getEffectivePaymentNetwork,
  readOptionalRequestBody,
  resolveRegistrySharedTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const ROUTE_PATH = "registry-entry-search";
const UPSTREAM_PATH = "/registry-entry-search/";

const app = createApiApp("/");

app.post("*", async (c) => {
  const request = c.req.raw;
  try {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    const body = await readOptionalRequestBody(request);
    requireNetworkedOidcApiScope(authContext, {
      resource: "registry",
      action: "read",
      network: getEffectivePaymentNetwork(request, body),
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
    if (error instanceof ApiError) throw error;
    rethrowIfAuthOrCreditsError(error);
    console.error(`[External Service Proxy:${ROUTE_PATH}]`, error);
    throw new ApiError(500, "Proxy request failed");
  }
});

export const { POST } = nextHandlers(app);
export default app;
