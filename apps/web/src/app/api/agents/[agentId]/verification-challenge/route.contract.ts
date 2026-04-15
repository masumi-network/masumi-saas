import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  defineRouteContract,
  jsonRequestBody,
  jsonResponse,
} from "@/lib/openapi/contracts";
import {
  security,
  stdResponses,
  verificationChallengePostBodySchema,
  verificationChallengeSuccessSchema,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Agents"],
  operations: {
    GET: {
      summary: "Get verification challenge",
      description: "Returns the current verification challenge for the agent.",
      security,
      request: { params: paramsSchema },
      responses: {
        200: jsonResponse("Challenge", verificationChallengeSuccessSchema),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
    POST: {
      summary: "Refresh verification challenge",
      description:
        'Optional body `{ "regenerate": true }` to issue a new challenge and invalidate the previous.',
      security,
      request: {
        params: paramsSchema,
        body: jsonRequestBody(verificationChallengePostBodySchema),
      },
      responses: {
        200: jsonResponse("Challenge", verificationChallengeSuccessSchema),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
  },
});

export default contract;

export { verificationChallengePostBodySchema as bodySchema };
