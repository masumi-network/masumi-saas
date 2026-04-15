import { activityTransactionQuerySchema } from "@/lib/schemas/api-query";
import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  activityTransactionSuccessSchema,
  errBody,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Activity"],
  operations: {
    GET: {
      summary: "Get activity transaction",
      description:
        "Loads a single payment or purchase visible to the caller by ID and transaction type.",
      security,
      request: {
        query: activityTransactionQuerySchema,
      },
      responses: {
        200: jsonResponse(
          "Transaction detail",
          activityTransactionSuccessSchema,
        ),
        503: jsonResponse(
          "Payment node is not configured or the active payment source is unavailable for the requested network.",
          errBody,
        ),
        ...stdResponses,
      },
    },
  },
});

export default contract;
