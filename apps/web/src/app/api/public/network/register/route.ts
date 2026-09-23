import { createRoute } from "@hono/zod-openapi";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import {
  networkRegisterAccountBodySchema,
  startNetworkRegistrationAccount,
} from "@/lib/network-registration";
import { NETWORK_REGISTER_CORS_OPTIONS } from "@/lib/network-registration/cors";
import { errBody, noSecurity } from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

const CORS_METHODS = ["POST", "OPTIONS"] as const;

const app = createApiApp("/api/public/network/register");

app.use("*", honoCors(CORS_METHODS, NETWORK_REGISTER_CORS_OPTIONS));

const successSchema = z.object({
  success: z.literal(true),
  email: z.string().email(),
  resultKey: z.literal("VerificationCodeSent"),
  devCode: z.string().optional(),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Network"],
    summary: "Start network registration (send email code)",
    description:
      "Creates or finds the user and emails a 6-digit verification code. Agent details are submitted only after the code is verified.",
    security: noSecurity,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: networkRegisterAccountBodySchema },
        },
      },
    },
    responses: {
      202: {
        description: "Verification code sent",
        content: { "application/json": { schema: successSchema } },
      },
      400: {
        description: "Invalid body",
        content: { "application/json": { schema: errBody } },
      },
      429: {
        description: "Rate limited",
        content: { "application/json": { schema: errBody } },
      },
      500: {
        description: "Could not start registration",
        content: { "application/json": { schema: errBody } },
      },
    },
  }),
  async (c) => {
    const { rl } = await checkRateLimitOrRespond(
      c.req.raw,
      "public-network-register",
    );

    const body = c.req.valid("json");
    const result = await startNetworkRegistrationAccount({ body });
    if (!result.ok) {
      throw new ApiError(result.status, result.error);
    }

    const response = c.json(
      {
        success: true as const,
        email: result.email,
        resultKey: "VerificationCodeSent" as const,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      },
      202,
    );
    response.headers.set("X-RateLimit-Limit", String(rl.limit));
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return response;
  },
);

export const { POST, OPTIONS } = nextHandlers(app);
export default app;
