import { createRoute } from "@hono/zod-openapi";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { completeNetworkRegistrationWithOtp } from "@/lib/network-registration";
import { errBody, noSecurity } from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

const CORS_METHODS = ["POST", "OPTIONS"] as const;

const app = createApiApp("/api/public/network/register/verify");

app.use("*", honoCors(CORS_METHODS));

const bodySchema = z.object({
  draftId: z.string().min(1),
  email: z.string().email(),
  otp: z.string().min(4).max(12),
});

const successSchema = z.object({
  success: z.literal(true),
  agentId: z.string(),
  status: z.enum(["registered", "pending"]),
  notes: z.array(z.string()),
  successPath: z.string(),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Network"],
    summary: "Verify network registration code and mint",
    description:
      "Verifies the email OTP on the marketing site origin, then completes agent registration server-side.",
    security: noSecurity,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: bodySchema } },
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
        description: "Invalid OTP",
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
      "public-network-register-verify",
    );

    const body = c.req.valid("json");
    const result = await completeNetworkRegistrationWithOtp({
      draftId: body.draftId,
      email: body.email,
      otp: body.otp,
      headers: c.req.raw.headers,
    });

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
