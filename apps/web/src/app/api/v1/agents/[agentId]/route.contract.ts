import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import { AgentSchema } from "@/lib/swagger/generator";
import { z } from "@/lib/swagger/zod-openapi";

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
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

const contract = defineRouteContract({
  documents: ["public-v1"],
  tags: ["Agents"],
  operations: {
    GET: {
      summary: "Get agent by ID",
      description:
        "Returns a single agent by its ID. No authentication required.",
      request: {
        params: paramsSchema,
      },
      responses: {
        200: jsonResponse("Agent found", successSchema),
        400: jsonResponse(
          "Bad Request — invalid query parameters",
          errorSchema,
        ),
        404: jsonResponse("Agent not found", errorSchema),
        429: jsonResponse(
          "Too Many Requests — rate limit exceeded. Check Retry-After header.",
          errorSchema,
        ),
        500: jsonResponse("Internal Server Error", errorSchema),
      },
    },
  },
});

export default contract;
