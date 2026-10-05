import { createRoute } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { parseNetwork } from "@/lib/schemas";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import { MAX_BATCH_RESOURCE_URLS } from "@/lib/x402/parse-batch-resource-urls";
import { findRegisteredX402ResourceUrlKeys } from "@/lib/x402/start-x402-http-agent-registration";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const bodySchema = z
  .object({
    resourceUrls: z
      .array(z.string().max(2000))
      .min(1)
      .max(MAX_BATCH_RESOURCE_URLS),
  })
  .openapi({
    example: {
      resourceUrls: [
        "https://x402.org/protected",
        "https://api.example.com/paid-endpoint",
      ],
    },
  });

const successSchema = z.object({
  success: z.literal(true),
  registeredResourceKeys: z.array(z.string()),
});

const app = createApiApp("/api/agents/x402-registered-check");

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Agents"],
    summary: "Check which x402 resource URLs are already registered",
    description:
      "Returns normalized URL keys for resources that already have an active Masumi agent for the current user, organization, and payment network.",
    security,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: bodySchema } },
      },
    },
    responses: {
      200: {
        description: "Registered resource keys",
        content: { "application/json": { schema: successSchema } },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    try {
      const authContext = await getAuthenticatedOrThrow(c.req.raw);
      const { user, activeOrganizationId } = authContext;
      const { resourceUrls } = c.req.valid("json");

      const url = new URL(c.req.url);
      const fromQuery = url.searchParams.get("network");
      const fromCookie = getCookie(c, "payment_network");
      const network = parseNetwork(fromQuery ?? fromCookie ?? undefined);

      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "read",
        network,
      });

      const registered = await findRegisteredX402ResourceUrlKeys({
        userId: user.id,
        organizationId: activeOrganizationId,
        network,
        resourceUrls,
      });

      return c.json(
        {
          success: true as const,
          registeredResourceKeys: [...registered],
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("x402 registered check failed:", error);
      throw new ApiError(500, "Failed to check registered x402 resources");
    }
  },
);

export const POST = nextHandlers(app).POST;

export default app;
