import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  security,
  stdResponses,
  testVerificationEndpointSuccessSchema,
  verificationUnavailableResponse,
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
      summary: "Test agent verification URL",
      security,
      request: { params: paramsSchema },
      responses: {
        200: jsonResponse("Test result", testVerificationEndpointSuccessSchema),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
  },
});

export default contract;
