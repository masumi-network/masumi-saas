import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { AGENT_STATES_WITH_EARNINGS } from "@/lib/earnings/agent-income";
import { listUserOwnedAgentsForEarnings } from "@/lib/earnings/owned-agent";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { parseNetwork } from "@/lib/schemas";

import contract from "./route.contract";

export type EarningsAgentsApiResponse =
  | {
      success: true;
      data: Array<{
        id: string;
        name: string;
        icon: string | null;
        agentIdentifier: string;
        registrationState: string;
        network: "Mainnet" | "Preprod";
      }>;
    }
  | { success: false; error: string };

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

    const network = parseNetwork(request.nextUrl.searchParams.get("network"));
    requireNetworkedOidcApiScope(authContext, {
      resource: "earnings",
      action: "read",
      network,
    });

    const agents = await listUserOwnedAgentsForEarnings({
      userId: authContext.user.id,
      network,
    });

    const filteredAgents = [...agents]
      .filter(
        (agent) =>
          Boolean(agent.agentIdentifier) &&
          AGENT_STATES_WITH_EARNINGS.has(agent.registrationState),
      )
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        icon: agent.icon,
        agentIdentifier: agent.agentIdentifier!,
        registrationState: agent.registrationState,
        network,
      }));

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: filteredAgents,
    } satisfies EarningsAgentsApiResponse);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to list earnings agents:", error);
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to load eligible agents",
    } satisfies EarningsAgentsApiResponse);
  }
}
