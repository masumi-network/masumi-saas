import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  agentTransactionsSuccessSchema,
  errBody,
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
      summary: "Agent transactions",
      description: "Payment and purchase activity for one agent.",
      security,
      request: { params: paramsSchema },
      responses: {
        200: jsonResponse("Transactions", agentTransactionsSuccessSchema),
        503: jsonResponse("Payment node unavailable", errBody),
        ...stdResponses,
      },
    },
  },
});

export default contract;
