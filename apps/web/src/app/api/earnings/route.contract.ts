import { earningsQuerySchema } from "@/lib/schemas/api-query";
import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  security,
  stdResponses,
  userEarningsSuccessSchema,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Earnings"],
  operations: {
    GET: {
      summary: "User earnings summary",
      security,
      request: {
        query: earningsQuerySchema,
      },
      responses: {
        200: jsonResponse(
          "Earnings / payouts summary",
          userEarningsSuccessSchema,
        ),
        ...stdResponses,
      },
    },
  },
});

export default contract;
