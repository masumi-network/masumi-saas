import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  agentDeletedSuccessSchema,
  agentDetailSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Agents"],
  operations: {
    GET: {
      summary: "Get agent",
      security,
      request: { params: paramsSchema },
      responses: {
        200: jsonResponse("Agent detail", agentDetailSuccessSchema),
        ...stdResponses,
      },
    },
    DELETE: {
      summary: "Delete agent",
      security,
      request: { params: paramsSchema },
      responses: {
        200: jsonResponse("Deleted", agentDeletedSuccessSchema),
        ...stdResponses,
      },
    },
  },
});

export default contract;
