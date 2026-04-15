import { agentAnalyticsQuerySchema } from "@/lib/schemas/api-query";
import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  agentAnalyticsSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Earnings"],
  operations: {
    GET: {
      summary: "Get per-agent earnings analytics",
      description:
        "Returns earnings analytics, time-bucketed series, and display-unit totals for one owned agent on the selected network.",
      security,
      request: {
        query: agentAnalyticsQuerySchema,
      },
      responses: {
        200: jsonResponse(
          "Per-agent earnings analytics",
          agentAnalyticsSuccessSchema,
        ),
        ...stdResponses,
      },
    },
  },
});

export default contract;
