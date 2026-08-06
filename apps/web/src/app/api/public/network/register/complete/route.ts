import { createRoute } from "@hono/zod-openapi";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import {
  completeNetworkRegistrationWithTicket,
  networkRegisterCompleteBodySchema,
} from "@/lib/network-registration";
import { NETWORK_REGISTER_CORS_OPTIONS } from "@/lib/network-registration/cors";
import { errBody, noSecurity } from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

const CORS_METHODS = ["POST", "OPTIONS"] as const;

const app = createApiApp("/api/public/network/register/complete");

app.use("*", honoCors(CORS_METHODS, NETWORK_REGISTER_CORS_OPTIONS));

const successSchema = z.object({
  success: z.literal(true),
  agentId: z.string(),
  status: z.enum(["registered", "pending"]),
  notes: z.array(z.string()),
  successPath: z
    .string()
    .describe("Absolute URL on the masumi.network marketing site"),
  continueUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "When status is pending, poll registration completion on this SaaS URL before successPath",
    ),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Network"],
    summary: "Complete network registration and mint",
    description:
      "Accepts a registration token from email verification plus agent/payment/mint details, then starts on-chain registration.",
    security: noSecurity,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: networkRegisterCompleteBodySchema },
        },
      },
    },
    responses: {
      200: {
        description: "Registration completed or pending on-chain",
        content: { "application/json": { schema: successSchema } },
      },
      400: {
        description: "Invalid request or registration failed",
        content: { "application/json": { schema: errBody } },
      },
      401: {
        description: "Invalid or expired registration token",
        content: { "application/json": { schema: errBody } },
      },
      403: {
        description: "KYC required",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
              needsKyc: z.literal(true),
              kycContinueUrl: z.string().url(),
            }),
          },
        },
      },
      429: {
        description: "Rate limited",
        content: { "application/json": { schema: errBody } },
      },
    },
  }),
  async (c) => {
    const { rl } = await checkRateLimitOrRespond(
      c.req.raw,
      "public-network-register-complete",
    );

    const body = c.req.valid("json");
    const result = await completeNetworkRegistrationWithTicket({ body });

    if (!result.ok) {
      if (result.needsKyc) {
        const response = c.json(
          {
            error: result.error,
            needsKyc: true as const,
            kycContinueUrl: result.kycContinueUrl!,
          },
          403,
        );
        response.headers.set("X-RateLimit-Limit", String(rl.limit));
        response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
        return response;
      }
      throw new ApiError(result.status === 401 ? 401 : 400, result.error);
    }

    const response = c.json(
      {
        success: true as const,
        agentId: result.agentId,
        status: result.status,
        notes: result.notes,
        successPath: result.successPath,
        ...(result.continueUrl ? { continueUrl: result.continueUrl } : {}),
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
