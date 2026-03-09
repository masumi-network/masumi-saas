import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);

    const networkParam = request.nextUrl.searchParams.get("network");
    const network =
      networkParam === "Mainnet" || networkParam === "Preprod"
        ? networkParam
        : "Preprod";

    const baseWhere = { userId: user.id, networkIdentifier: network };

    const [all, registered, deregistered, pending, failed, verified] =
      await Promise.all([
        prisma.agent.count({ where: baseWhere }),
        prisma.agent.count({
          where: {
            ...baseWhere,
            registrationState: "RegistrationConfirmed",
          },
        }),
        prisma.agent.count({
          where: {
            ...baseWhere,
            registrationState: "DeregistrationConfirmed",
          },
        }),
        prisma.agent.count({
          where: {
            ...baseWhere,
            registrationState: {
              in: ["RegistrationRequested", "DeregistrationRequested"],
            },
          },
        }),
        prisma.agent.count({
          where: {
            ...baseWhere,
            registrationState: {
              in: ["RegistrationFailed", "DeregistrationFailed"],
            },
          },
        }),
        prisma.agent.count({
          where: {
            ...baseWhere,
            verificationStatus: "VERIFIED",
          },
        }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        all,
        registered,
        deregistered,
        pending,
        failed,
        verified,
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get agent counts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get agent counts" },
      { status: 500 },
    );
  }
}
