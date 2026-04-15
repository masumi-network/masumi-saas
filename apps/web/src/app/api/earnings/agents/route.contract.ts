import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  earningsAgentsSuccessSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";

const earningsAgentsQuerySchema = z.object({
  network: z.enum(["Mainnet", "Preprod"]).optional().openapi({
    description: "Target payment network. Defaults to `Preprod` when omitted.",
    example: "Preprod",
  }),
});

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Earnings"],
  operations: {
    GET: {
      summary: "List agents eligible for earnings analytics",
      description:
        "Returns owned agents that have a payment identifier and a registration state eligible for earnings reporting.",
      security,
      request: {
        query: earningsAgentsQuerySchema,
      },
      responses: {
        200: jsonResponse(
          "Agents eligible for earnings reporting",
          earningsAgentsSuccessSchema,
        ),
        ...stdResponses,
      },
    },
  },
});

export default contract;
