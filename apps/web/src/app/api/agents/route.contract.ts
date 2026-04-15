import {
  defineRouteContract,
  jsonRequestBody,
  jsonResponse,
} from "@/lib/openapi/contracts";
import {
  agentsListSuccessSchema,
  errBody,
  insufficientCreditsResponse,
  registerAgentOpenApiBodySchema,
  security,
  startRegistrationSuccessSchema,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import {
  agentsListQuerySchema,
  registerAgentBodySchema,
} from "@/lib/schemas/agent";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Agents"],
  operations: {
    GET: {
      summary: "List agents",
      description:
        "Paginated list of the authenticated user’s agents. Effective **network** filter uses the `network` query param, or the `payment_network` cookie when the query is omitted.",
      security,
      request: {
        query: agentsListQuerySchema,
      },
      responses: {
        200: jsonResponse("Agent list", agentsListSuccessSchema),
        ...stdResponses,
      },
    },
    POST: {
      summary: "Start agent registration",
      description:
        "Creates a new agent and begins registration in Masumi SaaS. Returns **400** if `tags` is missing or empty after splitting on commas (at least one tag required).",
      security,
      request: {
        body: jsonRequestBody(registerAgentOpenApiBodySchema),
      },
      responses: {
        200: jsonResponse(
          "Registration started",
          startRegistrationSuccessSchema,
        ),
        402: insufficientCreditsResponse,
        503: jsonResponse("Payment node unavailable", errBody),
        ...stdResponses,
      },
    },
  },
});

export default contract;

export { registerAgentBodySchema };
