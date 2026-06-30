import { createRoute } from "@hono/zod-openapi";
import prisma from "@masumi/database/client";
import { randomUUID } from "crypto";

import { fetchAgentCredentialChallenge } from "@/lib/agent-verification";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { withStoredHolderOobi } from "@/lib/registry/stored-credential-attributes";
import {
  credentialIssueBodySchema,
  credentialIssueSuccessSchema,
  security,
  stdResponses,
  verificationUnavailableResponse,
} from "@/lib/swagger/saas-app-openapi";
import {
  getAgentVerificationSchemaSaid,
  issueCredential,
  resolveOobi,
} from "@/lib/veridian";
import { buildCredentialAttributesForAgent } from "@/lib/veridian/build-registry-verifications";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/credentials/issue");

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Credentials"],
    summary: "Issue verification credential",
    description:
      "Requests a Veridian credential for an owned, registered agent after validating KYC, agent endpoint HMAC verification, and optional organization membership.",
    security,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: credentialIssueBodySchema },
        },
      },
    },
    responses: {
      200: {
        description: "Credential issued",
        content: {
          "application/json": { schema: credentialIssueSuccessSchema },
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

    const authContext = await getAuthenticatedOrThrow(c.req.raw);
    const { user } = authContext;

    const { aid, oobi, attributes, agentId, organizationId, expiresAt } =
      c.req.valid("json");

    const schemaSaid = getAgentVerificationSchemaSaid();

    // Get user data with KYC verification
    const userWithKyc = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        kycVerification: true,
      },
    });

    if (!userWithKyc) {
      throw new ApiError(404, "User not found");
    }

    if (!userWithKyc.kycVerification) {
      throw new ApiError(
        400,
        "KYC verification not found. Please complete KYC verification first.",
      );
    }

    if (userWithKyc.kycVerification.status !== "APPROVED") {
      throw new ApiError(
        400,
        `KYC verification is ${userWithKyc.kycVerification.status}. Please complete KYC verification first.`,
      );
    }

    const foundAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
    });

    if (!foundAgent) {
      throw new ApiError(
        404,
        "Agent not found or you don't have permission to issue credentials for this agent",
      );
    }
    requireNetworkedOidcApiScope(authContext, {
      resource: "credentials",
      action: "write",
      network:
        foundAgent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    });

    if (foundAgent.registrationState !== "RegistrationConfirmed") {
      throw new ApiError(
        400,
        `Cannot issue credential for agent with registration state ${foundAgent.registrationState}. Agent must be registered.`,
      );
    }

    // Verify agent ownership via get-credential endpoint (HMAC-based)
    const challenge = foundAgent.verificationChallenge;
    const secret = foundAgent.verificationSecret;
    if (!challenge || !secret) {
      throw new ApiError(
        400,
        "No verification challenge or secret found. Generate from the Request Credential dialog and add the secret to your agent.",
      );
    }

    const agentVerification = await fetchAgentCredentialChallenge(
      foundAgent.apiUrl,
      challenge,
      secret,
    );

    if (!agentVerification.success) {
      throw new ApiError(400, agentVerification.error, {
        details: [
          "Ensure your agent has MASUMI_VERIFICATION_SECRET in env and returns HMAC-SHA256(challenge, secret).",
          "If the issue persists, contact support.",
        ],
      });
    }

    if (!foundAgent.agentIdentifier) {
      throw new ApiError(
        400,
        "Agent does not have a payment node identifier. Please ensure the agent is fully registered.",
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

    const credentialAttributes = buildCredentialAttributesForAgent({
      versionedAgentIdentifier: foundAgent.agentIdentifier,
      agentName: agent.name,
      agentApiUrl: agent.apiUrl,
      kycVerificationId: userWithKyc.kycVerification.id,
      signature: agentVerification.signature,
      extraAttributes: filteredAttributes,
    });

    if (organizationId) {
      const member = await prisma.member.findFirst({
        where: {
          organizationId,
          userId: user.id,
        },
      });

      if (!member) {
        throw new ApiError(
          404,
          "Organization not found or you're not a member",
        );
      }
    }

    // Resolve OOBI so the credential server knows the recipient AID
    if (oobi) {
      try {
        await resolveOobi(oobi);
      } catch (error) {
        console.error("Failed to resolve OOBI:", error);
        throw new ApiError(
          500,
          error instanceof Error
            ? `Failed to resolve OOBI: ${error.message}`
            : "Failed to resolve OOBI. The credential server needs to know about the recipient AID before issuing credentials.",
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
        throw new ApiError(500, "Failed to issue credential", {
          details: result.data,
        });
      }

      const placeholderCredentialId = `pending-${randomUUID()}`;
      const pendingCredential = await prisma.veridianCredential.create({
        data: {
          credentialId: placeholderCredentialId,
          schemaSaid,
          aid,
          status: "PENDING",
          credentialData: JSON.stringify(
            withStoredHolderOobi(credentialAttributes, oobi),
          ),
          attributes: JSON.stringify(
            withStoredHolderOobi(credentialAttributes, oobi),
          ),
          userId: user.id,
          agentId,
          organizationId: organizationId || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      return c.json(
        {
          success: true as const,
          data: {
            id: pendingCredential.id,
            credentialId: pendingCredential.credentialId,
            schemaSaid: pendingCredential.schemaSaid,
            aid: pendingCredential.aid,
            status: pendingCredential.status,
            issuedAt: pendingCredential.issuedAt,
            expiresAt: pendingCredential.expiresAt,
          },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to issue credential via Veridian:", error);
      throw new ApiError(
        500,
        error instanceof Error
          ? `Failed to issue credential: ${error.message}`
          : "Failed to issue credential",
      );
    }
  },
);

export const { POST } = nextHandlers(app);
export default app;
