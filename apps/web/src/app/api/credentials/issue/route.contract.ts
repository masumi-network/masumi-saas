import {
  defineRouteContract,
  jsonRequestBody,
  jsonResponse,
} from "@/lib/openapi/contracts";
import {
  credentialIssueBodySchema,
  credentialIssueSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Credentials"],
  operations: {
    POST: {
      summary: "Issue verification credential",
      description:
        "Requests a Veridian credential for an owned, registered agent after validating KYC, challenge signature, and optional organization membership.",
      security,
      request: {
        body: jsonRequestBody(credentialIssueBodySchema, {
          required: true,
        }),
      },
      responses: {
        200: jsonResponse("Credential issued", credentialIssueSuccessSchema),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
  },
});

export default contract;

export { credentialIssueBodySchema as issueCredentialSchema };
