import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";

const credentialStatusEnum = z.enum([
  "PENDING",
  "ISSUED",
  "REVOKED",
  "EXPIRED",
]);

/** Public subset of stored Veridian VC metadata (no signing material / credentialData). */
export const agentVerificationCredentialSummarySchema = z.object({
  localCredentialRecordId: z.string(),
  credentialId: z.string(),
  schemaSaid: z.string(),
  aid: z.string(),
  credentialStatus: credentialStatusEnum,
  issuedAt: z.string(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  lastUpdatedAt: z.string(),
  claimedRegistryAgentIdentifier: z.string().nullable(),
  credentialAgentDisplayName: z.string().nullable(),
  credentialAgentApiUrl: z.string().nullable(),
  registryAgentIdentifier: z.string().nullable(),
});

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

export const verificationCredentialSummarySuccessSchema = z.object({
  success: z.literal(true),
  data: agentVerificationCredentialSummarySchema.nullable(),
});

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Agents"],
  operations: {
    GET: {
      summary: "Get agent verification credential summary",
      description:
        "Returns non-sensitive metadata for the Veridian credential linked to this agent (when credential-based verification applies). Omit `data` (`null`) when there is nothing to show.",
      security,
      request: { params: paramsSchema },
      responses: {
        200: jsonResponse(
          "Credential summary",
          verificationCredentialSummarySuccessSchema,
        ),
        503: verificationUnavailableResponse,
        ...stdResponses,
      },
    },
  },
});

export default contract;
