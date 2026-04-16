import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  credentialIssuerOobiSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Credentials"],
  operations: {
    GET: {
      summary: "Get issuer OOBI",
      description:
        "Returns the Veridian issuer OOBI that agents can resolve before credential issuance.",
      security,
      responses: {
        200: jsonResponse("Issuer OOBI", credentialIssuerOobiSuccessSchema),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
  },
});

export default contract;
