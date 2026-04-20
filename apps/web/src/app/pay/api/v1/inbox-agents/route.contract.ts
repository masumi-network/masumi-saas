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
        "Paginated list of the authenticated user’s inbox-agent registrations. Effective `network` comes from the query param or the `payment_network` cookie. Continue pagination only with the same `network`, `filterStatus`, and `search`; changing any of them requires restarting without `cursor`, otherwise the endpoint may return HTTP 410.",
      security,
      request: {
        query: inboxAgentsListQuerySchema,
      },
      responses: {
        200: jsonResponse("Inbox-agent list", inboxAgentsListSuccessSchema),
        410: jsonResponse("Stale cursor", errBody),
        ...stdResponses,
      },
    },
    POST: {
      summary: "Register inbox agent",
      description:
        "Registers a new inbox agent after normalizing the slug. A configured server-side executing wallet pays for the registration and receives the registration asset; ownership is tracked locally for the authenticated user.",
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
        503: jsonResponse("Payment node unavailable", errBody),
        ...stdResponses,
      },
    },
  },
});

export default contract;
