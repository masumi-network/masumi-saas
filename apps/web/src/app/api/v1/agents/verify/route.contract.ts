import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { agentVerifyQuerySchema } from "@/lib/schemas";
import {
  errorResponses,
  verifyAgentResultSchema,
} from "@/lib/swagger/generator";

const contract = defineRouteContract({
  documents: ["public-v1"],
  tags: ["Agents"],
  operations: {
    GET: {
      summary: "Verify agent identifier",
      description:
        "Looks up a public agent by `agentIdentifier` and reports whether it currently has an active verification credential.",
      request: {
        query: agentVerifyQuerySchema,
      },
      responses: {
        200: jsonResponse("Verification result", verifyAgentResultSchema),
        ...errorResponses,
      },
    },
  },
});

export default contract;
