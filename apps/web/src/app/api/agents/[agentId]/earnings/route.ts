import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  fetchNormalizedAgentPaymentIncome,
  hasAgentEarningsData,
} from "@/lib/earnings/agent-income";
import { getUserOwnedAgentForEarnings } from "@/lib/earnings/owned-agent";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { agentEarningsQuerySchema } from "@/lib/schemas";

import contract from "./route.contract";

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
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const { agentId } = await params;

    const agent = await getUserOwnedAgentForEarnings({
      userId: authContext.user.id,
      agentId,
    });

    if (!agent) {
      return contractJsonResponse(contract, "GET", 404, {
        success: false,
        error: "Agent not found",
      });
    }
    const network = toNetwork(
      agent.agentReference?.networkIdentifier ?? agent.networkIdentifier,
    );

    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "read",
      network,
    });

    if (!hasAgentEarningsData(agent)) {
      return contractJsonResponse(contract, "GET", 200, {
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

    const { searchParams } = new URL(request.url);
    const queryResult = agentEarningsQuerySchema.safeParse({
      period: searchParams.get("period") ?? undefined,
    });
    if (!queryResult.success) {
      return contractJsonResponse(contract, "GET", 400, {
        success: false,
        error: queryResult.error.issues.map((i) => i.message).join("; "),
      });
    }
    const period = queryResult.data.period;

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return contractJsonResponse(contract, "GET", 200, {
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

    const { startDate, endDate } = periodToDateRange(period);

    const income = await fetchNormalizedAgentPaymentIncome({
      client,
      network,
      agentIdentifier: agent.agentIdentifier!,
      startDate,
      endDate,
      timeZone: "Etc/UTC",
    });

    return contractJsonResponse(contract, "GET", 200, {
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
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to load earnings",
    });
  }
}
