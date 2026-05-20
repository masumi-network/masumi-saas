import { createRoute } from "@hono/zod-openapi";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { requestMagicLinkRegistration } from "@/lib/auth/email-registration";
import {
  registerByEmailApiBodySchema,
  registerByEmailApiSuccessSchema,
} from "@/lib/schemas/auth-api";
import { errBody, noSecurity } from "@/lib/swagger/saas-app-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

const REGISTER_EMAIL_CORS_METHODS = ["POST", "OPTIONS"] as const;

const app = createApiApp("/api/register/email");

app.use("*", honoCors(REGISTER_EMAIL_CORS_METHODS));

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Auth"],
    summary: "Register with email",
    description:
      "Creates a new account if needed, then sends a magic sign-in link to the provided email address. The client must confirm terms acceptance before calling this route.",
    security: noSecurity,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: registerByEmailApiBodySchema },
        },
      },
    },
    responses: {
      202: {
        description: "Magic link accepted for delivery",
        content: {
          "application/json": { schema: registerByEmailApiSuccessSchema },
        },
      },
      400: {
        description: "Invalid request body",
        content: { "application/json": { schema: errBody } },
      },
      429: {
        description: "Too many registration requests from this client",
        content: { "application/json": { schema: errBody } },
      },
      500: {
        description: "Registration email could not be queued or sent",
        content: { "application/json": { schema: errBody } },
      },
    },
  }),
  async (c) => {
    const { rl } = await checkRateLimitOrRespond(
      c.req.raw,
      "public-register-email",
    );

    const data = c.req.valid("json");

    const result = await requestMagicLinkRegistration({
      email: data.email,
      name: data.name,
      callbackUrl: sanitizeCallbackUrl(data.callbackUrl) ?? "/",
      headers: c.req.raw.headers,
    });

    if ("error" in result) {
      throw new ApiError(500, result.error);
    }

    const response = c.json(result, 202);
    response.headers.set("X-RateLimit-Limit", String(rl.limit));
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return response;
  },
);

export const { POST, OPTIONS } = nextHandlers(app);
export default app;
