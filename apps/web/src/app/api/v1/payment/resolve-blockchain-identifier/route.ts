import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { executeCreditChargedProxyWrite } from "@/lib/v1-proxy/credit-charged-proxy-write";
import {
  getEffectivePaymentNetwork,
  readOptionalRequestBody,
  resolvePaymentUserTokenUpstream,
} from "@/lib/v1-proxy/explicit-route-support";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const ROUTE_PATH = "payment/resolve-blockchain-identifier";
const UPSTREAM_PATH = "/payment/resolve-blockchain-identifier";

const app = createApiApp("/");

app.post("*", async (c) => {
  const request = c.req.raw;
  try {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    const body = await readOptionalRequestBody(request);
    const network = getEffectivePaymentNetwork(request, body);
    requireNetworkedOidcApiScope(authContext, {
      resource: "payments",
      action: "read",
      network,
    });

    const upstream = await resolvePaymentUserTokenUpstream(authContext.user.id);
    if (!upstream.ok) {
      return c.json(
        { success: false as const, error: upstream.error },
        upstream.status as never,
      );
    }

    return executeCreditChargedProxyWrite({
      userId: authContext.user.id,
      network,
      routePath: ROUTE_PATH,
      upstreamPath: UPSTREAM_PATH,
      upstreamBaseUrl: upstream.baseUrl,
      token: upstream.token,
      request,
      method: "POST",
      body,
      authMethod: authContext.authMethod,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    rethrowIfAuthOrCreditsError(error);
    console.error(`[External Service Proxy:${ROUTE_PATH}]`, error);
    throw new ApiError(500, "Proxy request failed");
  }
});

export const { POST } = nextHandlers(app);
export default app;
