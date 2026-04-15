import { inboxAgentIdRouteParamSchema } from "@/lib/schemas/inbox-agent";
import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
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
    DELETE: {
      summary: "Delete inbox agent",
      description:
        "Deletes an inbox-agent registration after SaaS verifies it belongs to the caller and is in a user-safe terminal state.",
      security,
      request: { params: paramsSchema },
      responses: {
        200: jsonResponse("Deleted", inboxAgentMutationSuccessSchema),
        ...stdResponses,
      },
    },
  },
});

export default contract;
