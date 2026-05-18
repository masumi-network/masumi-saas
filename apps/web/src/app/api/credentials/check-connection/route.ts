import { createRoute } from "@hono/zod-openapi";

import { requireAnyNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import {
  credentialCheckConnectionBodySchema,
  credentialCheckConnectionSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { checkContactExists } from "@/lib/veridian";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/credentials/check-connection");

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Credentials"],
    summary: "Check recipient AID connection",
    description:
      "Validates whether Veridian already knows the recipient AID before issuing a credential.",
    security,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: credentialCheckConnectionBodySchema },
        },
      },
    },
    responses: {
      200: {
        description: "Recipient AID connection status",
        content: {
          "application/json": {
            schema: credentialCheckConnectionSuccessSchema,
          },
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

    const auth = await getAuthenticatedOrThrow(c.req.raw);
    requireAnyNetworkedOidcApiScope(auth, {
      resource: "credentials",
      action: "read",
    });

    const { aid } = c.req.valid("json");

    try {
      const exists = await checkContactExists(aid);
      return c.json({ success: true as const, data: { exists } }, 200);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to check connection:", error);
      throw new ApiError(
        500,
        error instanceof Error ? error.message : "Failed to check connection",
      );
    }
  },
);

export const { POST } = nextHandlers(app);
export default app;
