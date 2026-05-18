import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
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
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const ROUTE_PATH = "payment/submit-result";
const UPSTREAM_PATH = "/payment/submit-result";

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
      action: "write",
      network,
    });

    const upstream = await resolvePaymentUserTokenUpstream(authContext.user.id);
    if (!upstream.ok) {
      return c.json(
        { success: false as const, error: upstream.error },
        upstream.status as never,
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
