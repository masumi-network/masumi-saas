import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  defineRouteContract,
  jsonRequestBody,
  jsonResponse,
} from "@/lib/openapi/contracts";
import {
  errBodyWithOptionalDetails,
  security,
  stdResponses,
  verificationUnavailableResponse,
  verifyAgentOpenApiBodySchema,
  verifyAgentSuccessSchema,
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
    POST: {
      summary: "Verify agent (credential flow)",
      security,
      request: {
        params: paramsSchema,
        body: jsonRequestBody(verifyAgentOpenApiBodySchema),
      },
      responses: {
        ...stdResponses,
        200: jsonResponse("Verification step result", verifyAgentSuccessSchema),
        400: jsonResponse(
          "Invalid body (e.g. missing `aid`), KYC/agent preconditions, or credential validation failure. May include `details` (string[] or credential metadata object).",
          errBodyWithOptionalDetails,
        ),
        503: verificationUnavailableResponse,
      },
    },
  },
});

export default contract;

export { verifyAgentOpenApiBodySchema as verifyAgentBodySchema };
