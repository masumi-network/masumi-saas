import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";

type Network = "Mainnet" | "Preprod";

function toNetwork(networkIdentifier: string | null): Network {
  if (networkIdentifier === "Mainnet" || networkIdentifier === "Preprod")
    return networkIdentifier;
  return "Preprod";
}

function periodToDateRange(period: "1d" | "7d" | "30d" | "all"): {
  startDate: string;
  endDate: string;
} {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case "1d":
      start.setDate(start.getDate() - 1);
      break;
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "all":
      start.setFullYear(2020, 0, 1);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: user.id },
      select: { agentIdentifier: true, networkIdentifier: true },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") ?? "7d") as
      | "1d"
      | "7d"
      | "30d"
      | "all";

    const client = await getPaymentNodeClientForUser(user.id);
    if (!client) {
      return NextResponse.json({
        success: true,
        data: {
          totalTransactions: 0,
          totalIncome: { units: [], blockchainFees: 0 },
          totalRefunded: { units: [], blockchainFees: 0 },
          totalPending: { units: [], blockchainFees: 0 },
          periodStart: null,
          periodEnd: null,
        },
      });
    }

    const network = toNetwork(agent.networkIdentifier);
    const { startDate, endDate } = periodToDateRange(period);

    const income = await client.getPaymentIncome({
      network,
      agentIdentifier: agent.agentIdentifier ?? undefined,
      startDate,
      endDate,
      timeZone: "Etc/UTC",
    });

    return NextResponse.json({
      success: true,
      data: {
        totalTransactions: income.totalTransactions,
        totalIncome: income.totalIncome,
        totalRefunded: income.totalRefunded,
        totalPending: income.totalPending,
        periodStart: income.periodStart,
        periodEnd: income.periodEnd,
        dailyIncome: income.dailyIncome,
        monthlyIncome: income.monthlyIncome,
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get agent earnings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load earnings" },
      { status: 500 },
    );
  }
}
