import { jsonResponse, defineRouteContract } from "@/lib/openapi/contracts";
import { AgentSchema } from "@/lib/swagger/generator";
import { z } from "@/lib/swagger/zod-openapi";

export const publicAgentsQuerySchema = z.object({
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
      pagination: {
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      },
    },
  });

const publicErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const contract = defineRouteContract({
  documents: ["public-v1"],
  tags: ["Agents"],
  operations: {
    GET: {
      summary: "List agents",
      description:
        "Returns a list of agents filtered by verification status. Defaults to VERIFIED agents only. No authentication required. **Only** the query parameters documented here are applied; extra parameters are ignored.",
      request: {
        query: publicAgentsQuerySchema,
      },
      responses: {
        200: jsonResponse("List of agents", publicAgentListSuccessSchema),
        400: jsonResponse(
          "Bad Request — invalid query parameters",
          publicErrorSchema,
        ),
        429: jsonResponse(
          "Too Many Requests — rate limit exceeded. Check Retry-After header.",
          publicErrorSchema,
        ),
        500: jsonResponse("Internal Server Error", publicErrorSchema),
      },
    },
  },
});

export default contract;
