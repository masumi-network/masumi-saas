import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow();

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
    console.error("Failed to get agent counts:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get agent counts",
      },
      { status: 500 },
    );
  }
}
