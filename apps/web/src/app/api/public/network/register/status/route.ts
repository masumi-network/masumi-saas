import { createRoute } from "@hono/zod-openapi";

import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { pollNetworkRegistrationStatus } from "@/lib/network-registration";
import { NETWORK_REGISTER_CORS_OPTIONS } from "@/lib/network-registration/cors";
import { errBody, noSecurity } from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { honoCors } from "@/server/hono/middleware/cors";
import { nextHandlers } from "@/server/hono/next";

const CORS_METHODS = ["POST", "OPTIONS"] as const;

const app = createApiApp("/api/public/network/register/status");

app.use("*", honoCors(CORS_METHODS, NETWORK_REGISTER_CORS_OPTIONS));

const requestSchema = z.object({
  draftId: z.string().min(1),
  pollToken: z.string().min(1),
});

const pendingSchema = z.object({
  success: z.literal(true),
  status: z.literal("pending"),
  agentId: z.string(),
});

const registeredSchema = z.object({
  success: z.literal(true),
  status: z.literal("registered"),
  agentId: z.string(),
  successPath: z
    .string()
    .describe("Absolute URL on the masumi.network marketing site"),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Network"],
    summary: "Poll network registration mint status",
    description:
      "Polls on-chain registration completion for a pending draft using a poll token issued at /complete time. No SaaS session required.",
    security: noSecurity,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: requestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Registration still pending or completed",
        content: {
          "application/json": {
            schema: z.union([pendingSchema, registeredSchema]),
          },
        },
      },
      400: {
        description: "Invalid request or registration failed",
        content: { "application/json": { schema: errBody } },
      },
      401: {
        description: "Invalid or expired poll token",
        content: { "application/json": { schema: errBody } },
      },
      404: {
        description: "Registration not found",
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
      "public-network-register-status",
    );

    const body = c.req.valid("json");
    const result = await pollNetworkRegistrationStatus({
      draftId: body.draftId,
      pollToken: body.pollToken,
    });

    if (!result.ok) {
      throw new ApiError(result.status, result.error);
    }

    const response =
      result.status === "registered"
        ? c.json(
            {
              success: true as const,
              status: "registered" as const,
              agentId: result.agentId,
              successPath: result.successPath,
            },
            200,
          )
        : c.json(
            {
              success: true as const,
              status: "pending" as const,
              agentId: result.agentId,
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
