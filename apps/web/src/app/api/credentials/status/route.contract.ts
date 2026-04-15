import { credentialStatusQuerySchema } from "@/lib/schemas/api-query";
import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  credentialStatusSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Credentials"],
  operations: {
    GET: {
      summary: "Get credential status",
      description:
        "Polls the current credential state for a pending or issued verification credential owned by the caller.",
      security,
      request: {
        query: credentialStatusQuerySchema,
      },
      responses: {
        200: jsonResponse("Credential status", credentialStatusSuccessSchema),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
  },
});

export default contract;
