import { createRoute } from "@hono/zod-openapi";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import {
  createNetworkRegistrationDraft,
  networkRegisterBodySchema,
} from "@/lib/network-registration";
import { errBody, noSecurity } from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

const CORS_METHODS = ["POST", "OPTIONS"] as const;

const app = createApiApp("/api/public/network/register");

app.use("*", honoCors(CORS_METHODS));

const successSchema = z.object({
  success: z.literal(true),
  draftId: z.string(),
  email: z.string().email(),
  resultKey: z.literal("VerificationCodeSent"),
  notes: z.array(z.string()),
  devCode: z.string().optional(),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Network"],
    summary: "Start network-site agent registration",
    description:
      "Stores a registration draft and emails a 6-digit verification code. The client verifies the code on the marketing site, then mint completes server-side.",
    security: noSecurity,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: networkRegisterBodySchema },
        },
      },
    },
    responses: {
      202: {
        description:
          "Draft stored; verification code sent (or logged in development)",
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
    const result = await createNetworkRegistrationDraft({
      body,
      headers: c.req.raw.headers,
    });

    if (!result.ok) {
      throw new ApiError(result.status, result.error);
    }

    const response = c.json(
      {
        success: true as const,
        draftId: result.draftId,
        email: result.email,
        resultKey: "VerificationCodeSent" as const,
        notes: result.notes,
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
