import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { credentialReconcileQuerySchema } from "@/lib/schemas/api-query";
import {
  credentialReconcileSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Credentials"],
  operations: {
    GET: {
      summary: "Reconcile pending credentials",
      description:
        "Checks pending credentials for an owned agent and marks the first matching issued credential as resolved.",
      security,
      request: {
        query: credentialReconcileQuerySchema,
      },
      responses: {
        200: jsonResponse(
          "Credential reconciliation result",
          credentialReconcileSuccessSchema,
        ),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
  },
});

export default contract;
