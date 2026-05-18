import { createRoute } from "@hono/zod-openapi";

import { requireAnyNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import {
  credentialIssuerOobiSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { getIssuerOobi } from "@/lib/veridian";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/credentials/issuer-oobi");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Credentials"],
    summary: "Get issuer OOBI",
    description:
      "Returns the Veridian issuer OOBI that agents can resolve before credential issuance.",
    security,
    responses: {
      200: {
        description: "Issuer OOBI",
        content: {
          "application/json": { schema: credentialIssuerOobiSuccessSchema },
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
      const issuerOobi = await getIssuerOobi();
      return c.json(
        { success: true as const, data: { oobi: issuerOobi } },
        200,
      );
    } catch (error) {
      console.error("Failed to get issuer OOBI:", error);
      throw new ApiError(500, "Failed to get issuer OOBI");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
