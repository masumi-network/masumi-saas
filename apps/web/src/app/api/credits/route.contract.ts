import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  creditsBalanceSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Credits"],
  operations: {
    GET: {
      summary: "Get remaining credits",
      description:
        "Canonical credits endpoint for the authenticated SaaS API. Returns the authenticated user’s remaining write credits.",
      security,
      responses: {
        200: jsonResponse("Current balance", creditsBalanceSuccessSchema),
        ...stdResponses,
      },
    },
  },
});

export default contract;
