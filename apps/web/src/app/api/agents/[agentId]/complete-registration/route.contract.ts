import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  completeRegistrationPendingSchema,
  completeRegistrationSuccessSchema,
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
      summary: "Complete on-chain registration",
      security,
      request: { params: paramsSchema },
      responses: {
        ...stdResponses,
        200: jsonResponse(
          "Registration completed on-chain",
          completeRegistrationSuccessSchema,
        ),
        202: jsonResponse(
          "Registration still pending (e.g. registry submission or blockchain confirmation); poll again shortly.",
          completeRegistrationPendingSchema,
        ),
      },
    },
  },
});

export default contract;
