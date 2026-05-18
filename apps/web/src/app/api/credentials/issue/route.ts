import prisma from "@masumi/database/client";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

import { fetchAgentCredentialChallenge } from "@/lib/agent-verification";
import { apiError } from "@/lib/api/error";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import {
  getAgentVerificationSchemaSaid,
  issueCredential,
  resolveOobi,
} from "@/lib/veridian";

import contract, { issueCredentialSchema } from "./route.contract";

export async function POST(request: NextRequest) {
  try {
    if (!isAgentVerificationFlowEnabled()) {
      return apiError(
        verificationFeatureCopy.agentVerificationUnavailableDescription,
        503,
        undefined,
        { contract, method: "POST" },
      );
    }

    const authContext = await getAuthenticatedOrThrow(request);
    const { user } = authContext;

    const body = await request.json().catch(() => ({}));
    const validation = issueCredentialSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        "Invalid request",
        400,
        validation.error.issues.map((issue) => issue.message),
        { contract, method: "POST" },
      );
    }

    const { aid, oobi, attributes, agentId, organizationId, expiresAt } =
      validation.data;

    const schemaSaid = getAgentVerificationSchemaSaid();

    // Get user data with KYC verification
    const userWithKyc = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        kycVerification: true,
      },
    });

    if (!userWithKyc) {
      return apiError("User not found", 404, undefined, {
        contract,
        method: "POST",
      });
    }

    if (!userWithKyc.kycVerification) {
      return apiError(
        "KYC verification not found. Please complete KYC verification first.",
        400,
        undefined,
        { contract, method: "POST" },
      );
    }

    if (userWithKyc.kycVerification.status !== "APPROVED") {
      return apiError(
        `KYC verification is ${userWithKyc.kycVerification.status}. Please complete KYC verification first.`,
        400,
        undefined,
        { contract, method: "POST" },
      );
    }

    const foundAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
    });

    if (!foundAgent) {
      return apiError(
        "Agent not found or you don't have permission to issue credentials for this agent",
        404,
        undefined,
        { contract, method: "POST" },
      );
    }
    requireNetworkedOidcApiScope(authContext, {
      resource: "credentials",
      action: "write",
      network:
        foundAgent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });

    if (foundAgent.registrationState !== "RegistrationConfirmed") {
      return apiError(
        `Cannot issue credential for agent with registration state ${foundAgent.registrationState}. Agent must be registered.`,
        400,
        undefined,
        { contract, method: "POST" },
      );
    }

    // Verify agent ownership via get-credential endpoint (HMAC-based)
    const challenge = foundAgent.verificationChallenge;
    const secret = foundAgent.verificationSecret;
    if (!challenge || !secret) {
      return apiError(
        "No verification challenge or secret found. Generate from the Request Credential dialog and add the secret to your agent.",
        400,
        undefined,
        { contract, method: "POST" },
      );
    }

    const agentVerification = await fetchAgentCredentialChallenge(
      foundAgent.apiUrl,
      challenge,
      secret,
    );

    if (!agentVerification.success) {
      return apiError(
        agentVerification.error,
        400,
        [
          "Ensure your agent has MASUMI_VERIFICATION_SECRET in env and returns HMAC-SHA256(challenge, secret).",
          "If the issue persists, contact support.",
        ],
        { contract, method: "POST" },
      );
    }

    if (!foundAgent.agentIdentifier) {
      return apiError(
        "Agent does not have a payment node identifier. Please ensure the agent is fully registered.",
        400,
        undefined,
        { contract, method: "POST" },
      );
    }

    const agent = {
      id: foundAgent.id,
      agentIdentifier: foundAgent.agentIdentifier,
      name: foundAgent.name,
      apiUrl: foundAgent.apiUrl,
    };

    // Protected fields that cannot be overridden by user-provided attributes
    const protectedFields = [
      "kycVerificationId",
      "agentId",
      "agentName",
      "agentApiUrl",
      "signature",
    ];

    // Filter out protected fields from user-provided attributes
    const filteredAttributes = attributes
      ? Object.fromEntries(
          Object.entries(attributes).filter(
            ([key]) => !protectedFields.includes(key),
          ),
        )
      : {};

    // Build credential attributes with internal fields taking precedence
    const credentialAttributes = {
      ...filteredAttributes,
      kycVerificationId: userWithKyc.kycVerification.id,
      agentId: agent.agentIdentifier,
      agentName: agent.name,
      agentApiUrl: agent.apiUrl,
      signature: agentVerification.signature,
    };

    if (organizationId) {
      const member = await prisma.member.findFirst({
        where: {
          organizationId,
          userId: user.id,
        },
      });

      if (!member) {
        return apiError(
          "Organization not found or you're not a member",
          404,
          undefined,
          {
            contract,
            method: "POST",
          },
        );
      }
    }

    // Resolve OOBI so the credential server knows the recipient AID
    if (oobi) {
      try {
        await resolveOobi(oobi);
      } catch (error) {
        console.error("Failed to resolve OOBI:", error);
        return apiError(
          error instanceof Error
            ? `Failed to resolve OOBI: ${error.message}`
            : "Failed to resolve OOBI. The credential server needs to know about the recipient AID before issuing credentials.",
          500,
          undefined,
          { contract, method: "POST" },
        );
      }
    }

    try {
      const result = await issueCredential(
        schemaSaid,
        aid,
        credentialAttributes,
      );

      if (!result.success) {
        return apiError("Failed to issue credential", 500, result.data, {
          contract,
          method: "POST",
        });
      }

      const placeholderCredentialId = `pending-${randomUUID()}`;
      const pendingCredential = await prisma.veridianCredential.create({
        data: {
          credentialId: placeholderCredentialId,
          schemaSaid,
          aid,
          status: "PENDING",
          credentialData: JSON.stringify(credentialAttributes),
          attributes: JSON.stringify(credentialAttributes),
          userId: user.id,
          agentId,
          organizationId: organizationId || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      return contractJsonResponse(contract, "POST", 200, {
        success: true,
        data: {
          id: pendingCredential.id,
          credentialId: pendingCredential.credentialId,
          schemaSaid: pendingCredential.schemaSaid,
          aid: pendingCredential.aid,
          status: pendingCredential.status,
          issuedAt: pendingCredential.issuedAt,
          expiresAt: pendingCredential.expiresAt,
        },
      });
    } catch (error) {
      console.error("Failed to issue credential via Veridian:", error);
      return apiError(
        error instanceof Error
          ? `Failed to issue credential: ${error.message}`
          : "Failed to issue credential",
        500,
        undefined,
        { contract, method: "POST" },
      );
    }
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to issue credential:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to issue credential",
      500,
      undefined,
      { contract, method: "POST" },
    );
  }
}
