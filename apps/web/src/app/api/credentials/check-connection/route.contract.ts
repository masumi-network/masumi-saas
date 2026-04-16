import {
  defineRouteContract,
  jsonRequestBody,
  jsonResponse,
} from "@/lib/openapi/contracts";
import {
  credentialCheckConnectionBodySchema,
  credentialCheckConnectionSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Credentials"],
  operations: {
    POST: {
      summary: "Check recipient AID connection",
      description:
        "Validates whether Veridian already knows the recipient AID before issuing a credential.",
      security,
      request: {
        body: jsonRequestBody(credentialCheckConnectionBodySchema, {
          required: true,
        }),
      },
      responses: {
        200: jsonResponse(
          "Recipient AID connection status",
          credentialCheckConnectionSuccessSchema,
        ),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
  },
});

export default contract;

export { credentialCheckConnectionBodySchema as checkConnectionSchema };
