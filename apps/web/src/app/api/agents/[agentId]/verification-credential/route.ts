import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";
import { z as zRaw } from "zod";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { agentIdRouteParamSchema } from "@/lib/schemas/api-query";
import {
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents/{agentId}/verification-credential");

const paramsSchema = z.object({
  agentId: agentIdRouteParamSchema.openapi({
    param: { name: "agentId", in: "path" },
    description: "Agent ID (CUID)",
    example: "cmlf6gswz0000x1uctad958tq",
  }),
});

type StoredCredentialAttributes = {
  claimedRegistryAgentIdentifier: string | null;
  credentialAgentDisplayName: string | null;
  credentialAgentApiUrl: string | null;
};

const emptyStoredCredentialAttributes: StoredCredentialAttributes = {
  claimedRegistryAgentIdentifier: null,
  credentialAgentDisplayName: null,
  credentialAgentApiUrl: null,
};

const storedCredentialAttributeStringSchema = zRaw
  .unknown()
  .optional()
  .transform((value) => (typeof value === "string" ? value : null));

const storedCredentialAttributesSchema = zRaw
  .object({
    agentId: storedCredentialAttributeStringSchema,
    agentName: storedCredentialAttributeStringSchema,
    agentApiUrl: storedCredentialAttributeStringSchema,
  })
  .transform(
    ({ agentId, agentName, agentApiUrl }): StoredCredentialAttributes => ({
      claimedRegistryAgentIdentifier: agentId,
      credentialAgentDisplayName: agentName,
      credentialAgentApiUrl: agentApiUrl,
    }),
  );

const storedCredentialAttributesJsonSchema = zRaw
  .string()
  .nullable()
  .transform((json): unknown => {
    if (!json) return {};
    try {
      return JSON.parse(json) as unknown;
    } catch {
      return null;
    }
  })
  .pipe(storedCredentialAttributesSchema)
  .catch(emptyStoredCredentialAttributes);

function parseStoredCredentialAttributes(
  json: string | null,
): StoredCredentialAttributes {
  return storedCredentialAttributesJsonSchema.parse(json);
}

const credentialStatusEnum = z.enum([
  "PENDING",
  "ISSUED",
  "REVOKED",
  "EXPIRED",
]);

const agentVerificationCredentialSummarySchema = z.object({
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

const verificationCredentialSummarySuccessSchema = z.object({
  success: z.literal(true),
  data: agentVerificationCredentialSummarySchema.nullable(),
});

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "Get agent verification credential summary",
    description:
      "Returns non-sensitive metadata for the Veridian credential linked to this agent (when credential-based verification applies). Omit `data` (`null`) when there is nothing to show.",
    security,
    request: { params: paramsSchema },
    responses: {
      200: {
        description: "Credential summary",
        content: {
          "application/json": {
            schema: verificationCredentialSummarySuccessSchema,
          },
        },
      },
      503: verificationUnavailableResponse,
      ...stdResponses,
    },
  }),
  async (c) => {
    if (!isAgentVerificationFlowEnabled()) {
      throw new ApiError(
        503,
        verificationFeatureCopy.agentVerificationUnavailableDescription,
      );
    }

    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });
    const { agentId } = c.req.valid("param");

    try {
      const agent = await getWalletOwnedAgentForUser({
        userId: authContext.user.id,
        agentId,
      });

      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }

      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "read",
        network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
      });

      const agentVs = agent.verificationStatus ?? null;
      if (
        agentVs !== "VERIFIED" &&
        agentVs !== "REVOKED" &&
        agentVs !== "EXPIRED"
      ) {
        return c.json({ success: true as const, data: null }, 200);
      }

      const select = {
        id: true,
        credentialId: true,
        schemaSaid: true,
        aid: true,
        status: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
        updatedAt: true,
        attributes: true,
      } as const;

      let cred = agent.veridianCredentialId
        ? await prisma.veridianCredential.findFirst({
            where: {
              agentId,
              userId: authContext.user.id,
              credentialId: agent.veridianCredentialId,
            },
            select,
          })
        : null;

      cred ??= await prisma.veridianCredential.findFirst({
        where: { agentId, userId: authContext.user.id },
        orderBy: { issuedAt: "desc" },
        select,
      });

      if (!cred) {
        return c.json({ success: true as const, data: null }, 200);
      }

      const fromAttrs = parseStoredCredentialAttributes(cred.attributes);

      return c.json(
        {
          success: true as const,
          data: {
            localCredentialRecordId: cred.id,
            credentialId: cred.credentialId,
            schemaSaid: cred.schemaSaid,
            aid: cred.aid,
            credentialStatus: cred.status,
            issuedAt: cred.issuedAt.toISOString(),
            expiresAt: cred.expiresAt?.toISOString() ?? null,
            revokedAt: cred.revokedAt?.toISOString() ?? null,
            lastUpdatedAt: cred.updatedAt.toISOString(),
            claimedRegistryAgentIdentifier:
              fromAttrs.claimedRegistryAgentIdentifier,
            credentialAgentDisplayName: fromAttrs.credentialAgentDisplayName,
            credentialAgentApiUrl: fromAttrs.credentialAgentApiUrl,
            registryAgentIdentifier: agent.agentIdentifier,
          },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error(
        "[Agents] Failed to load verification credential summary:",
        error,
      );
      throw new ApiError(500, "Failed to load credential summary");
    }
  },
);

export const { GET } = nextHandlers(app);
export default app;
