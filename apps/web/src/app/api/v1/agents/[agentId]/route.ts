import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";
import { NextRequest } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { publicAgentSelect } from "@/lib/schemas/agent";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import { AgentSchema } from "@/lib/swagger/generator";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

export const routeMeta = { documents: ["public-v1"] as const };

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "The unique agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

const successSchema = z
  .object({
    success: z.literal(true),
    data: AgentSchema,
  })
  .openapi({
    example: {
      success: true,
      data: {
        id: "cmlf6gswz0000x1uctad958tq",
        name: "My AI Agent",
        description: "A payment processing agent on the Masumi network",
        apiUrl: "https://my-agent.example.com",
        verificationStatus: "VERIFIED",
        veridianCredentialId: "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
        tags: ["payments", "ai"],
        createdAt: "2026-01-26T10:00:00.000Z",
        updatedAt: "2026-01-26T12:00:00.000Z",
      },
    },
  });

const errorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const app = createApiApp("/api/v1/agents/{agentId}");

app.options("/", async (c) => {
  const request = new NextRequest(c.req.raw);
  return handleCorsPreflightResponse(request);
});

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "Get agent by ID",
    description:
      "Returns a single agent by its ID. No authentication required.",
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Agent found",
        content: { "application/json": { schema: successSchema } },
      },
      400: {
        description: "Bad Request — invalid query parameters",
        content: { "application/json": { schema: errorSchema } },
      },
      404: {
        description: "Agent not found",
        content: { "application/json": { schema: errorSchema } },
      },
      429: {
        description:
          "Too Many Requests — rate limit exceeded. Check Retry-After header.",
        content: { "application/json": { schema: errorSchema } },
      },
      500: {
        description: "Internal Server Error",
        content: { "application/json": { schema: errorSchema } },
      },
    },
  }),
  async (c) => {
    const request = new NextRequest(c.req.raw);
    try {
      const rateLimitResult = await checkRateLimitOrRespond(
        request,
        "public-agent",
      );
      if ("response" in rateLimitResult) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return rateLimitResult.response as any;
      }
      const { rl } = rateLimitResult;

      const { agentId } = c.req.valid("param");

      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: publicAgentSelect,
      });

      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }

      const res = c.json(
        {
          success: true as const,
          data: agent as unknown as z.infer<typeof AgentSchema>,
        },
        200,
      );
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return addCorsHeaders(res as any, request) as any;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Failed to get agent:", error);
      throw new ApiError(500, "Failed to get agent");
    }
  },
);

export const { GET, OPTIONS } = nextHandlers(app);
export default app;
