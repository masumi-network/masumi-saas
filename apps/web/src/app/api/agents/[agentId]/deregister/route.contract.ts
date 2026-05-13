import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  agentDeletedSuccessSchema,
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
    POST: {
      summary: "Deregister agent on-chain",
      security,
      request: { params: paramsSchema },
      responses: {
        200: jsonResponse("Deregistered", agentDeletedSuccessSchema),
        503: jsonResponse(
          "Payment service unavailable",
          z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        ),
        ...stdResponses,
      },
    },
  },
});

export default contract;
