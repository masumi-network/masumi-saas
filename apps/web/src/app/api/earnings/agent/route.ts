import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  type AgentEarningsAnalytics,
  buildAgentEarningsAnalytics,
  buildEmptyAgentEarningsAnalytics,
  fetchNormalizedAgentPaymentIncome,
  hasAgentEarningsData,
  resolveAgentAnalyticsPeriod,
} from "@/lib/earnings/agent-income";
import { getUserOwnedAgentForEarnings } from "@/lib/earnings/owned-agent";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { agentAnalyticsQuerySchema } from "@/lib/schemas";

import contract from "./route.contract";

export type AgentAnalyticsApiResponse =
  | {
      success: true;
      data: AgentEarningsAnalytics & {
        agent: {
          id: string;
          name: string;
          icon: string | null;
          agentIdentifier: string | null;
          network: "Mainnet" | "Preprod";
        };
      };
    }
  | { success: false; error: string };

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

    const query = agentAnalyticsQuerySchema.safeParse({
      agentId: request.nextUrl.searchParams.get("agentId") ?? undefined,
      network: request.nextUrl.searchParams.get("network") ?? undefined,
      range: request.nextUrl.searchParams.get("range") ?? undefined,
      startDate: request.nextUrl.searchParams.get("startDate") ?? undefined,
      endDate: request.nextUrl.searchParams.get("endDate") ?? undefined,
      timeZone: request.nextUrl.searchParams.get("timeZone") ?? undefined,
    });

    if (!query.success) {
      return contractJsonResponse(contract, "GET", 400, {
        success: false,
        error: query.error.issues.map((issue) => issue.message).join("; "),
      });
    }

    const { agentId, network, range, startDate, endDate, timeZone } =
      query.data;

    requireNetworkedOidcApiScope(authContext, {
      resource: "earnings",
      action: "read",
      network,
    });

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

    const agentNetwork = toNetwork(
      agent.agentReference?.networkIdentifier ?? agent.networkIdentifier,
    );

    if (agentNetwork !== network) {
      return contractJsonResponse(contract, "GET", 404, {
        success: false,
        error: "Agent not found",
      });
    }

    const resolvedPeriod = resolveAgentAnalyticsPeriod({
      range,
      startDate,
      endDate,
      timeZone,
    });

    const agentMeta = {
      id: agent.id,
      name: agent.name,
      icon: agent.icon,
      agentIdentifier: agent.agentIdentifier,
      network,
    } as const;

    if (!hasAgentEarningsData(agent)) {
      return contractJsonResponse(contract, "GET", 200, {
        success: true,
        data: {
          agent: agentMeta,
          ...buildEmptyAgentEarningsAnalytics({
            network,
            range,
            granularity: resolvedPeriod.granularity,
            timeZone,
            resolvedStartDate: resolvedPeriod.startDate,
            resolvedEndDate: resolvedPeriod.endDate,
          }),
        },
      } satisfies AgentAnalyticsApiResponse);
    }

    const client = await getPaymentNodeClientForUser(authContext.user.id);
    if (!client) {
      return contractJsonResponse(contract, "GET", 200, {
        success: true,
        data: {
          agent: agentMeta,
          ...buildEmptyAgentEarningsAnalytics({
            network,
            range,
            granularity: resolvedPeriod.granularity,
            timeZone,
            resolvedStartDate: resolvedPeriod.startDate,
            resolvedEndDate: resolvedPeriod.endDate,
          }),
        },
      } satisfies AgentAnalyticsApiResponse);
    }

    const income = await fetchNormalizedAgentPaymentIncome({
      client,
      network,
      agentIdentifier: agent.agentIdentifier!,
      startDate: resolvedPeriod.startDate,
      endDate: resolvedPeriod.endDate,
      timeZone,
    });

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: {
        agent: agentMeta,
        ...buildAgentEarningsAnalytics({
          income,
          network,
          range,
          granularity: resolvedPeriod.granularity,
          timeZone,
          resolvedStartDate: resolvedPeriod.startDate,
          resolvedEndDate: resolvedPeriod.endDate,
        }),
      },
    } satisfies AgentAnalyticsApiResponse);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get agent earnings analytics:", error);
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to load earnings",
    });
  }
}
