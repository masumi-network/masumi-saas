import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { inboxAgentIdRouteParamSchema } from "@/lib/schemas/inbox-agent";
import {
  inboxAgentMutationSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";

const paramsSchema = z.object({
  inboxAgentId: inboxAgentIdRouteParamSchema.openapi({
    description: "Inbox agent request ID (CUID)",
    example: "cm_inbox_1",
  }),
});

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Inbox agents"],
  operations: {
    POST: {
      summary: "Deregister inbox agent",
      description:
        "Starts deregistration for an inbox agent after SaaS verifies ownership and resolves the matching payment source smart contract.",
      security,
      request: { params: paramsSchema },
      responses: {
        200: jsonResponse(
          "Deregistration started",
          inboxAgentMutationSuccessSchema,
        ),
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
