import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";
import { NextRequest } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { publicAgentSelect } from "@/lib/schemas/agent";
import { AgentSchema } from "@/lib/swagger/generator";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

export const routeMeta = { documents: ["public-v1"] as const };

const publicAgentsQuerySchema = z.object({
  status: z
    .enum(["PENDING", "VERIFIED", "REVOKED", "EXPIRED"])
    .optional()
    .default("VERIFIED")
    .openapi({
      description:
        "Filter by agent verification status. Defaults to VERIFIED if not specified.",
      example: "VERIFIED",
    }),
  page: z.coerce.number().int().min(1).optional().default(1).openapi({
    description: "Page number for pagination. Defaults to 1.",
    example: 1,
  }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .openapi({
      description: "Number of results per page. Defaults to 50, max 100.",
      example: 50,
    }),
});

const publicAgentListSuccessSchema = z
  .object({
    success: z.literal(true),
    data: z.array(AgentSchema),
    pagination: z.object({
      page: z.number().int().openapi({ example: 1 }),
      limit: z.number().int().openapi({ example: 50 }),
      total: z.number().int().openapi({ example: 1 }),
      totalPages: z.number().int().openapi({ example: 1 }),
    }),
  })
  .openapi({
    example: {
      success: true,
      data: [
        {
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
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    },
  });

const publicErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const app = createApiApp("/api/v1/agents");

app.options("/", async (c) => {
  const request = new NextRequest(c.req.raw);
  return handleCorsPreflightResponse(request);
});

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "List agents",
    description:
      "Returns a list of agents filtered by verification status. Defaults to VERIFIED agents only. No authentication required. **Only** the query parameters documented here are applied; extra parameters are ignored.",
    request: { query: publicAgentsQuerySchema },
    responses: {
      200: {
        description: "List of agents",
        content: {
          "application/json": { schema: publicAgentListSuccessSchema },
        },
      },
      400: {
        description: "Bad Request — invalid query parameters",
        content: { "application/json": { schema: publicErrorSchema } },
      },
      429: {
        description:
          "Too Many Requests — rate limit exceeded. Check Retry-After header.",
        content: { "application/json": { schema: publicErrorSchema } },
      },
      500: {
        description: "Internal Server Error",
        content: { "application/json": { schema: publicErrorSchema } },
      },
    },
  }),
  async (c) => {
    const request = new NextRequest(c.req.raw);
    try {
      const rateLimitResult = await checkRateLimitOrRespond(
        request,
        "public-agents",
      );
      if ("response" in rateLimitResult) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return rateLimitResult.response as any;
      }
      const { rl } = rateLimitResult;

      const { status, page, limit } = c.req.valid("query");

      const where = { verificationStatus: status };
      const [agents, total] = await Promise.all([
        prisma.agent.findMany({
          where,
          select: publicAgentSelect,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: (page - 1) * limit,
        }),
        prisma.agent.count({ where }),
      ]);
      const totalPages = Math.ceil(total / limit);

      const res = c.json(
        {
          success: true as const,
          data: agents as unknown as z.infer<typeof AgentSchema>[],
          pagination: { page, limit, total, totalPages },
        },
        200,
      );
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      return addCorsHeaders(
        res as unknown as Parameters<typeof addCorsHeaders>[0],
        request,
      ) as unknown as typeof res;
    } catch (error) {
      console.error("Failed to list agents:", error);
      throw new ApiError(500, "Failed to list agents");
    }
  },
);

export const { GET, OPTIONS } = nextHandlers(app);
export default app;
