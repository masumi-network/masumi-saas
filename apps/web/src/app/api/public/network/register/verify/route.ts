import { createRoute } from "@hono/zod-openapi";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { verifyNetworkRegistrationAccount } from "@/lib/network-registration";
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
  email: z.string().email(),
  otp: z.string().min(4).max(12),
});

const successSchema = z.object({
  success: z.literal(true),
  email: z.string().email(),
  registrationToken: z.string(),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Network"],
    summary: "Verify network registration email code",
    description:
      "Verifies the email OTP and returns a short-lived registration token used to submit agent details and mint.",
    security: noSecurity,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: bodySchema } },
      },
    },
    responses: {
      200: {
        description: "Email verified; registration token issued",
        content: { "application/json": { schema: successSchema } },
      },
      400: {
        description: "Invalid request",
        content: { "application/json": { schema: errBody } },
      },
      401: {
        description: "Invalid OTP",
        content: { "application/json": { schema: errBody } },
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
    const result = await verifyNetworkRegistrationAccount({
      email: body.email,
      otp: body.otp,
      headers: c.req.raw.headers,
    });

    if (!result.ok) {
      throw new ApiError(401, result.error);
    }

    const response = c.json(
      {
        success: true as const,
        email: result.email,
        registrationToken: result.registrationToken,
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
