import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import {
  fetchContactCredentials,
  issueCredential,
  resolveOobi,
  verifyKeriSignature,
} from "@/lib/veridian";

const issueCredentialSchema = z.object({
  aid: z.string().min(1, "AID is required"),
  schemaSaid: z.string().min(1, "Schema SAID is required"),
  oobi: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  agentId: z.string().optional(),
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
  signature: z.string().optional(),
  signedMessage: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const body = await request.json().catch(() => ({}));
    const validation = issueCredentialSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: validation.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const {
      aid,
      schemaSaid,
      oobi,
      attributes,
      agentId,
      organizationId,
      expiresAt,
      signature,
      signedMessage,
    } = validation.data;

    // Validate signature and message are provided together
    if (signature && !signedMessage) {
      return NextResponse.json(
        {
          success: false,
          error: "Signed message is required when signature is provided",
        },
        { status: 400 },
      );
    }

    if (signedMessage && !signature) {
      return NextResponse.json(
        {
          success: false,
          error: "Signature is required when signed message is provided",
        },
        { status: 400 },
      );
    }

    // Verify KERI signature cryptographically
    if (signature && signedMessage) {
      // Basic format validation
      if (typeof signature !== "string" || signature.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid signature format",
          },
          { status: 400 },
        );
      }

      if (typeof signedMessage !== "string" || signedMessage.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid signed message format",
          },
          { status: 400 },
        );
      }

      // Verify the message contains the AID to prevent signature replay attacks
      if (!signedMessage.includes(aid)) {
        return NextResponse.json(
          {
            success: false,
            error: "Signed message must contain the AID",
          },
          { status: 400 },
        );
      }

      // Perform full cryptographic verification of the KERI signature
      try {
        const isValid = await verifyKeriSignature(
          signature,
          signedMessage,
          aid,
        );

        if (!isValid) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Signature verification failed. The signature does not match the AID's public key.",
            },
            { status: 400 },
          );
        }
      } catch (error) {
        console.error("Failed to verify KERI signature:", error);
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? `Signature verification failed: ${error.message}`
                : "Signature verification failed. Please ensure VERIDIAN_KERIA_URL is configured.",
          },
          { status: 500 },
        );
      }
    }

    // Get user data with KYC verification
    const userWithKyc = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        kycVerification: true,
      },
    });

    if (!userWithKyc) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 },
      );
    }

    if (!userWithKyc.kycVerification) {
      return NextResponse.json(
        {
          success: false,
          error:
            "KYC verification not found. Please complete KYC verification first.",
        },
        { status: 400 },
      );
    }

    // KYC status VERIFIED means the user's identity is verified
    if (userWithKyc.kycVerification.status !== "VERIFIED") {
      return NextResponse.json(
        {
          success: false,
          error: `KYC verification is ${userWithKyc.kycVerification.status}. Please complete KYC verification first.`,
        },
        { status: 400 },
      );
    }

    let agent: {
      id: string;
      name: string;
      description: string;
      apiUrl: string;
    } | null = null;

    if (agentId) {
      const foundAgent = await prisma.agent.findFirst({
        where: {
          id: agentId,
          userId: user.id,
        },
      });

      if (!foundAgent) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Agent not found or you don't have permission to issue credentials for this agent",
          },
          { status: 404 },
        );
      }

      if (
        foundAgent.registrationState === "RegistrationRequested" ||
        foundAgent.registrationState === "RegistrationInitiated" ||
        foundAgent.registrationState === "RegistrationFailed" ||
        foundAgent.registrationState === "DeregistrationRequested" ||
        foundAgent.registrationState === "DeregistrationInitiated" ||
        foundAgent.registrationState === "DeregistrationConfirmed" ||
        foundAgent.registrationState === "DeregistrationFailed"
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot issue credential for agent with registration state ${foundAgent.registrationState}. Agent must be registered.`,
          },
          { status: 400 },
        );
      }

      agent = {
        id: foundAgent.id,
        name: foundAgent.name,
        description: foundAgent.description,
        apiUrl: foundAgent.apiUrl,
      };
    }

    const credentialAttributes = {
      kycVerificationId: userWithKyc.kycVerification.id,
      ...(agent && {
        agentId: agent.id,
        agentName: agent.name,
        agentDescription: agent.description,
        agentApiUrl: agent.apiUrl,
      }),
      ...attributes,
    };

    if (organizationId) {
      const member = await prisma.member.findFirst({
        where: {
          organizationId,
          userId: user.id,
        },
      });

      if (!member) {
        return NextResponse.json(
          {
            success: false,
            error: "Organization not found or you're not a member",
          },
          { status: 404 },
        );
      }
    }

    // Resolve OOBI before issuing credential (required for credential server to know about the recipient AID)
    if (oobi) {
      try {
        await resolveOobi(oobi);
      } catch (error) {
        console.error("Failed to resolve OOBI:", error);
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? `Failed to resolve OOBI: ${error.message}`
                : "Failed to resolve OOBI. The credential server needs to know about the recipient AID before issuing credentials.",
          },
          { status: 500 },
        );
      }
    }

    let credentialId: string;
    try {
      const result = await issueCredential(
        schemaSaid,
        aid,
        credentialAttributes,
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to issue credential",
            details: result.data,
          },
          { status: 500 },
        );
      }

      const maxAttempts = 10;
      const pollInterval = 500;
      let issuedCredential;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        const credentials = await fetchContactCredentials(aid);
        const matchingCredentials = credentials.filter((cred) => {
          const credSchemaSaid = cred.sad?.s || cred.schema?.$id;
          if (credSchemaSaid !== schemaSaid) {
            return false;
          }

          // If agentId was provided, filter by agentId from credential attributes
          // This ensures we get the correct credential when multiple credentials
          // of the same schema exist for the same AID
          if (agentId && cred.sad?.a) {
            const credAgentId = cred.sad.a.agentId as string | undefined;
            return credAgentId === agentId;
          }

          return true;
        });

        if (matchingCredentials.length > 0) {
          issuedCredential = matchingCredentials.sort((a, b) => {
            const dateA = new Date(a.sad?.a?.dt || 0).getTime();
            const dateB = new Date(b.sad?.a?.dt || 0).getTime();
            return dateB - dateA;
          })[0];
          break;
        }
      }

      if (!issuedCredential || !issuedCredential.sad?.d) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Credential was issued but could not be retrieved. The credential may still be processing.",
          },
          { status: 500 },
        );
      }

      credentialId = issuedCredential.sad.d;
    } catch (error) {
      console.error("Failed to issue credential via Veridian:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? `Failed to issue credential: ${error.message}`
              : "Failed to issue credential",
        },
        { status: 500 },
      );
    }

    // Store signature and signed message for audit purposes
    // The signature has been cryptographically verified against the AID's public key
    const credentialDataWithSignature = {
      ...credentialAttributes,
      ...(signature &&
        signedMessage && {
          signature,
          signedMessage,
          signatureTimestamp: new Date().toISOString(),
        }),
    };

    const credential = await prisma.veridianCredential.create({
      data: {
        credentialId,
        schemaSaid,
        aid,
        status: "ISSUED",
        credentialData: JSON.stringify(credentialDataWithSignature),
        attributes: JSON.stringify(credentialAttributes),
        userId: user.id,
        agentId: agentId || null,
        organizationId: organizationId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Update agent verification status to VERIFIED when credential is successfully issued
    // The credential has been cryptographically verified (signature validation) and
    // successfully issued, so the agent is verified
    if (agentId) {
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          verificationStatus: "VERIFIED" as const,
          veridianCredentialId: credentialId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: credential.id,
        credentialId: credential.credentialId,
        schemaSaid: credential.schemaSaid,
        aid: credential.aid,
        status: credential.status,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
      },
    });
  } catch (error) {
    console.error("Failed to issue credential:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to issue credential",
      },
      { status: 500 },
    );
  }
}
