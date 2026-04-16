import {
  defineRouteContract,
  jsonRequestBody,
  jsonResponse,
} from "@/lib/openapi/contracts";
import { inboxAgentsListQuerySchema } from "@/lib/schemas/inbox-agent";
import {
  errBody,
  inboxAgentMutationSuccessSchema,
  inboxAgentsListSuccessSchema,
  insufficientCreditsResponse,
  registerInboxAgentOpenApiBodySchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Inbox agents"],
  operations: {
    GET: {
      summary: "List inbox agents",
      description:
        "Paginated list of the authenticated user’s inbox-agent registrations. Effective `network` comes from the query param or the `payment_network` cookie.",
      security,
      request: {
        query: inboxAgentsListQuerySchema,
      },
      responses: {
        200: jsonResponse("Inbox-agent list", inboxAgentsListSuccessSchema),
        ...stdResponses,
      },
    },
    POST: {
      summary: "Register inbox agent",
      description:
        "Registers a new inbox agent through the authenticated user’s payment-node token. The server normalizes the slug, creates the managed recipient wallet, and overrides wallet selection so a configured funding wallet pays while the new inbox wallet receives the registration asset.",
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
        503: jsonResponse("Payment node unavailable", errBody),
        ...stdResponses,
      },
    },
  },
});

export default contract;
