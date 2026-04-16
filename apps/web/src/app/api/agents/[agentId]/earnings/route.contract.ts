import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  agentEarningsQuerySchema,
  agentIdRouteParamSchema,
} from "@/lib/schemas/api-query";
import {
  agentEarningsSuccessSchema,
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
      summary: "Agent earnings",
      security,
      request: {
        params: paramsSchema,
        query: agentEarningsQuerySchema,
      },
      responses: {
        200: jsonResponse("Earnings", agentEarningsSuccessSchema),
        ...stdResponses,
      },
    },
  },
});

export default contract;
