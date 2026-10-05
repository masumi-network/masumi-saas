import { createRoute } from "@hono/zod-openapi";
import {
  evaluateX402SokosumiCompatibility,
  USDC_BY_EVM_NETWORK,
} from "@masumi/payment-source-x402";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { assertAllowedAgentApiUrl } from "@/lib/security/outbound-url";
import {
  errBody,
  noSecurity,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

const SUPPORTED_EVM_NETWORKS = Object.keys(USDC_BY_EVM_NETWORK) as [
  "eip155:8453",
  "eip155:84532",
];

const CORS_METHODS = ["POST", "OPTIONS"] as const;

const app = createApiApp("/api/public/x402/sokosumi-compatibility");

app.use("*", honoCors(CORS_METHODS));

const bodySchema = z
  .object({
    resourceUrl: z.string().url().max(2000),
    evmNetwork: z.enum(SUPPORTED_EVM_NETWORKS).optional(),
  })
  .openapi({
    example: {
      resourceUrl: "https://api.example.com/paid-endpoint",
      evmNetwork: "eip155:8453",
    },
  });

const checksSchema = z.object({
  schemeExact: z.boolean(),
  transferMethodEip3009OrAbsent: z.boolean(),
  trustedEip712Domain: z.boolean(),
  samePairEntriesAgree: z.boolean(),
  hasTimeoutWindow: z.boolean(),
});

const successSchema = z.object({
  success: z.literal(true),
  sokosumiCompatible: z.boolean(),
  incompatibleReason: z.string().nullable(),
  checks: checksSchema,
  resourceUrl: z.string().url(),
  evmNetwork: z.string(),
  accept: z.object({
    scheme: z.string(),
    asset: z.string(),
    payTo: z.string(),
    amount: z.string(),
    maxTimeoutSeconds: z.number().nullable(),
  }),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["x402"],
    summary: "Check Sokosumi buy-side compatibility for an x402 HTTP resource",
    description:
      "Public, unauthenticated live probe. GETs the resource URL, parses the 402 payment requirements for the requested EVM network (default Base mainnet `eip155:8453`), and returns Sokosumi hire gate results. Does not register an agent or consume credits.",
    security: noSecurity,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: bodySchema } },
      },
    },
    responses: {
      200: {
        description: "Probe completed (resource may still be incompatible)",
        content: {
          "application/json": { schema: successSchema },
        },
      },
      429: {
        description: "Rate limited",
        content: { "application/json": { schema: errBody } },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    await checkRateLimitOrRespond(
      c.req.raw,
      "public-x402-sokosumi-compatibility",
      { maxRequests: 30, windowMs: 60_000 },
    );

    const { resourceUrl, evmNetwork } = c.req.valid("json");
    const trimmedResourceUrl = resourceUrl.trim();
    const network = evmNetwork ?? "eip155:8453";

    try {
      await assertAllowedAgentApiUrl(trimmedResourceUrl);
    } catch (error) {
      if (error instanceof Error) {
        throw new ApiError(400, error.message);
      }
      throw new ApiError(400, "Invalid x402 resource URL");
    }

    const result = await evaluateX402SokosumiCompatibility({
      resourceUrl: trimmedResourceUrl,
      evmNetwork: network,
    });

    if (!result.ok) {
      throw new ApiError(400, result.error);
    }

    return c.json(
      {
        success: true as const,
        sokosumiCompatible: result.sokosumiCompatible,
        incompatibleReason: result.incompatibleReason,
        checks: result.checks,
        resourceUrl: result.row.resource,
        evmNetwork: result.row.network,
        accept: {
          scheme: result.row.scheme,
          asset: result.row.asset,
          payTo: result.row.payTo,
          amount: result.row.amount ?? "",
          maxTimeoutSeconds: result.row.maxTimeoutSeconds,
        },
      },
      200,
    );
  },
);

export const POST = nextHandlers(app).POST;
export const OPTIONS = nextHandlers(app).OPTIONS;

export default app;
