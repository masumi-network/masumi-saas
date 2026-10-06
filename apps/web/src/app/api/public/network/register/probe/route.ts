import { createRoute } from "@hono/zod-openapi";
import {
  CARDANO_NETWORK_BY_EVM,
  evmNetworkForCardanoPaymentNetwork,
  probeX402HttpResource,
} from "@masumi/payment-source-x402";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { NETWORK_REGISTER_CORS_OPTIONS } from "@/lib/network-registration/cors";
import { assertAllowedAgentApiUrl } from "@/lib/security/outbound-url";
import { errBody, noSecurity } from "@/lib/swagger/saas-app-openapi";
import { buildX402ResourceAutofill } from "@/lib/x402/resource-autofill";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

const CORS_METHODS = ["POST", "OPTIONS"] as const;

const app = createApiApp("/api/public/network/register/probe");

app.use("*", honoCors(CORS_METHODS, NETWORK_REGISTER_CORS_OPTIONS));

const probeBodySchema = z.object({
  resourceUrl: z.string().url().max(2000),
  cardanoNetwork: z.enum(["Mainnet", "Preprod"]),
});

const autofillSchema = z.object({
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
});

const probeSuccessSchema = z.object({
  success: z.literal(true),
  resourceUrl: z.string().url(),
  compatible: z.boolean(),
  checks: z.record(z.string(), z.unknown()),
  autofill: autofillSchema,
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Network"],
    summary: "Probe an x402 HTTP resource for network registration",
    description:
      "Validates that a public HTTP URL returns a Sokosumi-compatible 402 for the selected Cardano registry network.",
    security: noSecurity,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: probeBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Probe succeeded",
        content: { "application/json": { schema: probeSuccessSchema } },
      },
      400: {
        description: "Invalid URL or incompatible 402",
        content: { "application/json": { schema: errBody } },
      },
      429: {
        description: "Rate limited",
        content: { "application/json": { schema: errBody } },
      },
      500: {
        description: "Probe failed",
        content: { "application/json": { schema: errBody } },
      },
    },
  }),
  async (c) => {
    const { rl } = await checkRateLimitOrRespond(
      c.req.raw,
      "public-network-register-probe",
    );

    const { resourceUrl, cardanoNetwork } = c.req.valid("json");
    const trimmedResourceUrl = resourceUrl.trim();

    try {
      await assertAllowedAgentApiUrl(trimmedResourceUrl);
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? error.message : "Invalid x402 resource URL",
      );
    }

    const evmNetwork = evmNetworkForCardanoPaymentNetwork(cardanoNetwork);
    if (!CARDANO_NETWORK_BY_EVM[evmNetwork]) {
      throw new ApiError(400, "Unsupported registry network for x402 probe.");
    }

    const result = await probeX402HttpResource({
      resourceUrl: trimmedResourceUrl,
      evmNetwork,
    });

    if (!result.ok) {
      throw new ApiError(400, result.error);
    }

    const canonicalResourceUrl = result.row.resource;

    const autofill = buildX402ResourceAutofill({
      resource: canonicalResourceUrl,
      description: result.row.description,
      type: result.row.type,
      network: result.row.network,
      scheme: result.row.scheme,
    });

    const response = c.json(
      {
        success: true as const,
        resourceUrl: canonicalResourceUrl,
        compatible: result.compatibility.compatible,
        checks: result.compatibility.checks,
        autofill,
      },
      200,
    );
    response.headers.set("X-RateLimit-Limit", String(rl.limit));
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return response;
  },
);

export const { POST, OPTIONS } = nextHandlers(app);
export default app;
