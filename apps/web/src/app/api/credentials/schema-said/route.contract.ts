import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  credentialSchemaSaidSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Credentials"],
  operations: {
    GET: {
      summary: "Get verification schema SAID",
      description:
        "Returns the configured Veridian schema SAID for agent verification credentials.",
      security,
      responses: {
        200: jsonResponse(
          "Verification schema SAID",
          credentialSchemaSaidSuccessSchema,
        ),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
  },
});

export default contract;
