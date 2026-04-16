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
        "Compatibility alias for `/api/credits`. Returns the authenticated user’s remaining write credits. New users start with 1 credit; existing users stay at 0 until credits are granted outside this v1 flow.",
      security,
      responses: {
        200: jsonResponse("Current balance", creditsBalanceSuccessSchema),
        ...stdResponses,
      },
    },
  },
});

export default contract;
