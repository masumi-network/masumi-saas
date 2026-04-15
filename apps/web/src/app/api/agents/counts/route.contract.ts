import { agentCountsQuerySchema } from "@/lib/schemas/api-query";
import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  agentCountsSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Agents"],
  operations: {
    GET: {
      summary: "Aggregate agent counts",
      description: "Counts by status and network for the current user.",
      security,
      request: {
        query: agentCountsQuerySchema,
      },
      responses: {
        200: jsonResponse("Counts", agentCountsSuccessSchema),
        ...stdResponses,
      },
    },
  },
});

export default contract;
