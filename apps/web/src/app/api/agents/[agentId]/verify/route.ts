import prisma from "@masumi/database/client";
import { NextRequest } from "next/server";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { getWalletOwnedAgentForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import {
  fetchContactCredentials,
  findCredentialBySchema,
  getAgentVerificationSchemaSaid,
  validateCredential,
} from "@/lib/veridian";

import contract, { verifyAgentBodySchema } from "./route.contract";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    if (!isAgentVerificationFlowEnabled()) {
      return contractJsonResponse(contract, "POST", 503, {
        success: false,
        error: verificationFeatureCopy.agentVerificationUnavailableDescription,
      });
    }

    const authContext = await getAuthenticatedOrThrow(request);
    const { agentId } = await params;

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validation = verifyAgentBodySchema.safeParse(body);

    if (!validation.success) {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error: "Invalid request",
        details: validation.error.issues.map((issue) => issue.message),
      });
    }

    const { aid, schemaSaid } = validation.data;

    const agent = await getWalletOwnedAgentForUser({
      userId: authContext.user.id,
      agentId,
    });

    if (!agent) {
      return contractJsonResponse(contract, "POST", 404, {
        success: false,
        error: "Agent not found",
      });
    }
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "write",
      network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });

    const userWithKyc = await prisma.user.findUnique({
      where: { id: authContext.user.id },
      include: {
        kycVerification: true,
      },
    });

    if (!userWithKyc?.kycVerification) {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error:
          "KYC verification not found. Please complete KYC verification first.",
      });
    }

    // KYC status APPROVED means the user's identity is verified
    if (userWithKyc.kycVerification.status !== "APPROVED") {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error: `KYC verification is ${userWithKyc.kycVerification.status}. Please complete KYC verification first.`,
      });
    }

    // Verify AID ownership by checking if we have a credential record for this agent and AID
    // This ensures the user actually owns the AID (credential was issued with signature verification)
    const existingCredential = await prisma.veridianCredential.findFirst({
      where: {
        agentId: agentId,
        userId: authContext.user.id,
        aid: aid,
        status: "ISSUED",
      },
    });

    if (!existingCredential) {
      return contractJsonResponse(contract, "POST", 400, {
        success: false,
        error:
          "No credential found for this agent and AID. Please issue a credential first using the Request Credential dialog.",
      });
    }

    let credentialId: string | null = null;
    try {
      const credentials = await fetchContactCredentials(aid);

      if (credentials.length === 0) {
        return contractJsonResponse(contract, "POST", 400, {
          success: false,
          error:
            "No credentials found for this identifier. Please ensure you have credentials issued to this AID.",
        });
      }

      const expectedSchemaSaid = schemaSaid || getAgentVerificationSchemaSaid();

      const selectedCredential = findCredentialBySchema(
        credentials,
        expectedSchemaSaid,
      );

      if (!selectedCredential) {
        return contractJsonResponse(contract, "POST", 400, {
          success: false,
          error: `Required credential with schema SAID '${expectedSchemaSaid}' not found. Please ensure you have the correct credential issued to this identifier.`,
        });
      }

      const validationResult = validateCredential(selectedCredential);

      if (!validationResult.isValid) {
        return contractJsonResponse(contract, "POST", 400, {
          success: false,
          error: `Credential validation failed: ${validationResult.message}`,
          details: validationResult.details,
        });
      }

      credentialId = selectedCredential.sad?.d || null;
    } catch (error) {
      console.error("Failed to fetch/validate credentials:", error);
      return contractJsonResponse(contract, "POST", 500, {
        success: false,
        error: "Failed to validate credentials",
      });
    }

    // Update agent verification status to VERIFIED when credential validation succeeds
    // The credential has been validated and is valid, so the agent is verified
    const updatedAgent = await prisma.agent.update({
      where: {
        id: agentId,
      },
      data: {
        verificationStatus: "VERIFIED" as const,
        veridianCredentialId: credentialId,
      },
    });

    await recordAgentActivityEvent(agentId, "AgentVerified");

    return contractJsonResponse(contract, "POST", 200, {
      success: true,
      data: updatedAgent,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to request agent verification:", error);
    return contractJsonResponse(contract, "POST", 500, {
      success: false,
      error: "Failed to request agent verification",
    });
  }
}
