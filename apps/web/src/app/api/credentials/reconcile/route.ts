import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { apiError } from "@/lib/api/error";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { credentialReconcileQuerySchema } from "@/lib/schemas";
import {
  fetchContactCredentials,
  getAgentVerificationSchemaSaid,
} from "@/lib/veridian";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);

    const queryResult = credentialReconcileQuerySchema.safeParse({
      agentId: request.nextUrl.searchParams.get("agentId"),
    });
    if (!queryResult.success) {
      return apiError(
        queryResult.error.issues.map((i) => i.message).join("; ") ||
          "Invalid query",
        400,
      );
    }
    const { agentId } = queryResult.data;

    // Verify the agent belongs to this user
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: user.id },
      select: { id: true, agentIdentifier: true },
    });

    if (!agent) {
      return apiError("Agent not found", 404);
    }

    const pendingCredentials = await prisma.veridianCredential.findMany({
      where: { agentId, userId: user.id, status: "PENDING" },
    });

    if (pendingCredentials.length === 0) {
      return NextResponse.json({
        success: true,
        data: { resolved: false },
      });
    }

    const schemaSaid = getAgentVerificationSchemaSaid();
    let resolved = false;

    for (const pending of pendingCredentials) {
      try {
        const credentials = await fetchContactCredentials(pending.aid);
        const matchingCredentials = credentials.filter((cred) => {
          const credSchemaSaid = cred.sad?.s || cred.schema?.$id;
          if (credSchemaSaid !== schemaSaid) return false;

          if (cred.sad?.a && agent.agentIdentifier) {
            const credAgentId = cred.sad.a.agentId as string | undefined;
            return credAgentId === agent.agentIdentifier;
          }

          return true;
        });

        if (matchingCredentials.length === 0) continue;

        const issuedCredential = matchingCredentials.sort((a, b) => {
          const dateA = new Date((a.sad?.a?.dt as string) || 0).getTime();
          const dateB = new Date((b.sad?.a?.dt as string) || 0).getTime();
          return dateB - dateA;
        })[0];

        if (!issuedCredential?.sad?.d) continue;

        const credentialId = issuedCredential.sad.d;

        await prisma.veridianCredential.update({
          where: { id: pending.id },
          data: { credentialId, status: "ISSUED" },
        });

        await prisma.agent.update({
          where: { id: agentId },
          data: {
            verificationStatus: "VERIFIED",
            veridianCredentialId: credentialId,
          },
        });

        await recordAgentActivityEvent(agentId, "AgentVerified");

        resolved = true;
        // One resolved is enough to flip the agent to VERIFIED
        break;
      } catch (error) {
        // Log but continue checking other pending records
        console.error(`Failed to reconcile credential ${pending.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      data: { resolved },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to reconcile credentials:", error);
    return apiError(
      error instanceof Error
        ? `Failed to reconcile credentials: ${error.message}`
        : "Failed to reconcile credentials",
      500,
    );
  }
}
