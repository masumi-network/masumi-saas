import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { dashboardOverviewQuerySchema } from "@/lib/schemas/api-query";
import {
  dashboardOverviewSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Dashboard"],
  operations: {
    GET: {
      summary: "Dashboard overview",
      description:
        "User, organizations, agents, API keys, balance snapshot, KYC hints — scoped to the authenticated user.",
      security,
      request: {
        query: dashboardOverviewQuerySchema,
      },
      responses: {
        200: jsonResponse("Overview", dashboardOverviewSuccessSchema),
        ...stdResponses,
      },
    },
  },
});

export default contract;
