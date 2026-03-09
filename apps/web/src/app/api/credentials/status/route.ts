import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { apiError } from "@/lib/api/error";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  fetchContactCredentials,
  getAgentVerificationSchemaSaid,
} from "@/lib/veridian";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return apiError("Missing credential ID", 400);
    }

    const pendingCredential = await prisma.veridianCredential.findFirst({
      where: { id, userId: user.id },
    });

    if (!pendingCredential) {
      return apiError("Credential not found", 404);
    }

    // Already resolved — return current state immediately
    if (pendingCredential.status !== "PENDING") {
      return NextResponse.json({
        success: true,
        data: {
          id: pendingCredential.id,
          credentialId: pendingCredential.credentialId,
          status: pendingCredential.status,
        },
      });
    }

    const { aid, agentId } = pendingCredential;
    const schemaSaid = getAgentVerificationSchemaSaid();

    // Get agent's payment node identifier for filtering
    const agent = agentId
      ? await prisma.agent.findFirst({
          where: { id: agentId },
          select: { agentIdentifier: true },
        })
      : null;

    // Check Veridian for the accepted credential
    const credentials = await fetchContactCredentials(aid);
    const matchingCredentials = credentials.filter((cred) => {
      const credSchemaSaid = cred.sad?.s || cred.schema?.$id;
      if (credSchemaSaid !== schemaSaid) return false;

      if (cred.sad?.a && agent?.agentIdentifier) {
        const credAgentId = cred.sad.a.agentId as string | undefined;
        return credAgentId === agent.agentIdentifier;
      }

      return true;
    });

    if (matchingCredentials.length === 0) {
      return NextResponse.json({
        success: true,
        data: { id: pendingCredential.id, status: "PENDING" },
      });
    }

    const issuedCredential = matchingCredentials.sort((a, b) => {
      const dateA = new Date((a.sad?.a?.dt as string) || 0).getTime();
      const dateB = new Date((b.sad?.a?.dt as string) || 0).getTime();
      return dateB - dateA;
    })[0];

    if (!issuedCredential?.sad?.d) {
      return NextResponse.json({
        success: true,
        data: { id: pendingCredential.id, status: "PENDING" },
      });
    }

    const credentialId = issuedCredential.sad.d;

    const updated = await prisma.veridianCredential.update({
      where: { id: pendingCredential.id },
      data: { credentialId, status: "ISSUED" },
    });

    if (agentId) {
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          verificationStatus: "VERIFIED",
          veridianCredentialId: credentialId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        credentialId: updated.credentialId,
        status: updated.status,
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to check credential status:", error);
    return apiError(
      error instanceof Error
        ? `Failed to check credential status: ${error.message}`
        : "Failed to check credential status",
      500,
    );
  }
}
