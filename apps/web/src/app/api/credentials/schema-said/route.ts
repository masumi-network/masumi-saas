import { createRoute } from "@hono/zod-openapi";

import { requireAnyNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import {
  credentialSchemaSaidSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { getAgentVerificationSchemaSaid } from "@/lib/veridian";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/credentials/schema-said");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Credentials"],
    summary: "Get verification schema SAID",
    description:
      "Returns the configured Veridian schema SAID for agent verification credentials.",
    security,
    responses: {
      200: {
        description: "Verification schema SAID",
        content: {
          "application/json": { schema: credentialSchemaSaidSuccessSchema },
        },
      },
      503: verificationUnavailableResponse,
      ...stdResponses,
    },
  }),
  async (c) => {
    if (!isAgentVerificationFlowEnabled()) {
      throw new ApiError(
        503,
        verificationFeatureCopy.agentVerificationUnavailableDescription,
      );
    }

    const authContext = await getAuthenticatedOrThrow(c.req.raw);
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "credentials",
      action: "read",
    });

    try {
      const schemaSaid = getAgentVerificationSchemaSaid();
      return c.json({ success: true as const, data: { schemaSaid } }, 200);
    } catch (error) {
      console.error("Failed to get schema SAID:", error);
      throw new ApiError(500, "Failed to get schema SAID");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
