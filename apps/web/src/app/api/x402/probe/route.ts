import { createRoute } from "@hono/zod-openapi";
import {
  CARDANO_NETWORK_BY_EVM,
  evmNetworkForCardanoPaymentNetwork,
  probeX402HttpResource,
} from "@masumi/payment-source-x402";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { parseNetwork } from "@/lib/schemas";
import { assertAllowedAgentApiUrl } from "@/lib/security/outbound-url";
import { security, stdResponses } from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const probeBodySchema = z
  .object({
    resourceUrl: z.string().url().max(2000),
    network: z.enum(["Mainnet", "Preprod"]).optional(),
  })
  .openapi({
    example: {
      resourceUrl: "https://api.example.com/paid-endpoint",
      network: "Preprod",
    },
  });

const probeSuccessSchema = z.object({
  success: z.literal(true),
  row: z.record(z.string(), z.unknown()),
  checks: z.record(z.string(), z.unknown()),
});

const app = createApiApp("/api/x402/probe");

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["x402"],
    summary: "Probe an HTTP x402 resource",
    description:
      "GETs the resource without payment and validates Sokosumi buy-side compatibility for the selected Cardano registry network (maps to Base mainnet or Base Sepolia).",
    security,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: probeBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Probe succeeded",
        content: {
          "application/json": { schema: probeSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    try {
      const authContext = await getAuthenticatedOrThrow(c.req.raw);
      const { resourceUrl, network: networkBody } = c.req.valid("json");
      const network = parseNetwork(networkBody ?? undefined);

      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "read",
        network,
      });
      const evmNetwork = evmNetworkForCardanoPaymentNetwork(network);
      if (!CARDANO_NETWORK_BY_EVM[evmNetwork]) {
        throw new ApiError(400, "Unsupported registry network for x402 probe.");
      }

      const trimmedResourceUrl = resourceUrl.trim();
      try {
        await assertAllowedAgentApiUrl(trimmedResourceUrl);
      } catch (error) {
        if (error instanceof Error) {
          throw new ApiError(400, error.message);
        }
        throw new ApiError(400, "Invalid x402 resource URL");
      }

      const result = await probeX402HttpResource({
        resourceUrl: trimmedResourceUrl,
        evmNetwork,
      });

      if (!result.ok) {
        throw new ApiError(400, result.error);
      }

      return c.json(
        {
          success: true as const,
          row: result.row,
          checks: result.compatibility.checks,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("x402 probe failed:", error);
      throw new ApiError(500, "Failed to probe x402 resource");
    }
  },
);

export const POST = nextHandlers(app).POST;
