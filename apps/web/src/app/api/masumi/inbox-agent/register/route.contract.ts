import {
  defineRouteContract,
  jsonRequestBody,
  jsonResponse,
} from "@/lib/openapi/contracts";
import {
  errBody,
  inboxAgentMutationSuccessSchema,
  insufficientCreditsResponse,
  registerInboxAgentOpenApiBodySchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Inbox agents"],
  operations: {
    POST: {
      summary: "Register inbox agent",
      description:
        "Compatibility alias for `POST /pay/api/v1/inbox-agents`. Registers a new inbox agent with the same server-side executing-wallet flow as the canonical route.",
      security,
      request: {
        body: jsonRequestBody(registerInboxAgentOpenApiBodySchema),
      },
      responses: {
        200: jsonResponse(
          "Inbox-agent registration created",
          inboxAgentMutationSuccessSchema,
        ),
        402: insufficientCreditsResponse,
        409: jsonResponse("Inbox agent already owned by another user", errBody),
        ...stdResponses,
      },
    },
  },
});

export default contract;
