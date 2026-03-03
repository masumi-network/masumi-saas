import prisma from "@masumi/database/client";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchAgentCredentialChallenge } from "@/lib/agent-verification";
import { apiError } from "@/lib/api/error";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  getAgentVerificationSchemaSaid,
  issueCredential,
  resolveOobi,
} from "@/lib/veridian";

const issueCredentialSchema = z.object({
  aid: z.string().min(1, "AID is required"),
  oobi: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  agentId: z.string().min(1, "Agent ID is required"),
  organizationId: z.string().optional(),
  expiresAt: z
    .string()
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: "Invalid date format" },
    )
    .optional(),
  signature: z.string().min(1, "Signature is required"),
  signedMessage: z.string().min(1, "Signed message is required"),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow();

    const body = await request.json().catch(() => ({}));
    const validation = issueCredentialSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        "Invalid request",
        400,
        validation.error.issues.map((issue) => issue.message),
      );
    }

    const {
      aid,
      oobi,
      attributes,
      agentId,
      organizationId,
      expiresAt,
      signature,
      signedMessage,
    } = validation.data;

    const schemaSaid = getAgentVerificationSchemaSaid();

    // Get user data with KYC verification
    const userWithKyc = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        kycVerification: true,
      },
    });

    if (!userWithKyc) {
      return apiError("User not found", 404);
    }

    if (!userWithKyc.kycVerification) {
      return apiError(
        "KYC verification not found. Please complete KYC verification first.",
        400,
      );
    }

    if (userWithKyc.kycVerification.status !== "APPROVED") {
      return apiError(
        `KYC verification is ${userWithKyc.kycVerification.status}. Please complete KYC verification first.`,
        400,
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
      );
    }

    if (foundAgent.registrationState !== "RegistrationConfirmed") {
      return apiError(
        `Cannot issue credential for agent with registration state ${foundAgent.registrationState}. Agent must be registered.`,
        400,
      );
    }

    // Verify agent ownership via get-credential endpoint (HMAC-based)
    const challenge = foundAgent.verificationChallenge;
    const secret = foundAgent.verificationSecret;
    if (!challenge || !secret) {
      return apiError(
        "No verification challenge or secret found. Generate from the Request Credential dialog and add the secret to your agent.",
        400,
      );
    }

    const agentVerification = await fetchAgentCredentialChallenge(
      foundAgent.apiUrl,
      challenge,
      secret,
    );

    if (!agentVerification.success) {
      return apiError(agentVerification.error, 400, [
        "Ensure your agent has MASUMI_VERIFICATION_SECRET in env and returns HMAC-SHA256(challenge, secret).",
        "If the issue persists, contact support.",
      ]);
    }

    if (!foundAgent.agentIdentifier) {
      return apiError(
        "Agent does not have a payment node identifier. Please ensure the agent is fully registered.",
        400,
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
        return apiError("Organization not found or you're not a member", 404);
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
        );
      }
    }

    const credentialDataWithSignature = {
      ...credentialAttributes,
      ...(signature &&
        signedMessage && {
          signature,
          signedMessage,
          signatureTimestamp: new Date().toISOString(),
        }),
    };

    try {
      const result = await issueCredential(
        schemaSaid,
        aid,
        credentialAttributes,
      );

      if (!result.success) {
        return apiError("Failed to issue credential", 500, result.data);
      }

      const placeholderCredentialId = `pending-${randomUUID()}`;
      const pendingCredential = await prisma.veridianCredential.create({
        data: {
          credentialId: placeholderCredentialId,
          schemaSaid,
          aid,
          status: "PENDING",
          credentialData: JSON.stringify(credentialDataWithSignature),
          attributes: JSON.stringify(credentialAttributes),
          userId: user.id,
          agentId,
          organizationId: organizationId || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      return NextResponse.json({
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
      );
    }
  } catch (error) {
    console.error("Failed to issue credential:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to issue credential",
      500,
    );
  }
}
