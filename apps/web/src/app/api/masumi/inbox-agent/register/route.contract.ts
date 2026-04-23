import {
  defineRouteContract,
  jsonRequestBody,
  jsonResponse,
} from "@/lib/openapi/contracts";
import {
  errBody,
  inboxAgentRegisterConflictBody,
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
        "Compatibility alias for `POST /pay/api/v1/inbox-agents`. Registers a new inbox agent with the same server-side executing-wallet flow as the canonical route. Returns HTTP 409 when the slug is already active or pending on the selected network, or when the finalized registration resolves to another user's existing ownership record.",
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
        409: jsonResponse(
          "Inbox registration conflict",
          inboxAgentRegisterConflictBody,
        ),
        ...stdResponses,
      },
    },
  },
});

export default contract;
