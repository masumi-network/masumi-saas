import prisma from "@masumi/database/client";
import { NextRequest } from "next/server";
import { z } from "zod";

import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { contractJsonResponse } from "@/lib/openapi/contracts";

import contract from "./route.contract";

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

const storedCredentialAttributeStringSchema = z
  .unknown()
  .optional()
  .transform((value) => (typeof value === "string" ? value : null));

const storedCredentialAttributesSchema = z
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

const storedCredentialAttributesJsonSchema = z
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    if (!isAgentVerificationFlowEnabled()) {
      return contractJsonResponse(contract, "GET", 503, {
        success: false,
        error: verificationFeatureCopy.agentVerificationUnavailableDescription,
      });
    }

    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const { agentId } = await params;

    const agent = await getWalletOwnedAgentForUser({
      userId: authContext.user.id,
      agentId,
    });

    if (!agent) {
      return contractJsonResponse(contract, "GET", 404, {
        success: false,
        error: "Agent not found",
      });
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
      return contractJsonResponse(contract, "GET", 200, {
        success: true,
        data: null,
      });
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
      return contractJsonResponse(contract, "GET", 200, {
        success: true,
        data: null,
      });
    }

    const fromAttrs = parseStoredCredentialAttributes(cred.attributes);

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
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
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error(
      "[Agents] Failed to load verification credential summary:",
      error,
    );
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to load credential summary",
    });
  }
}
