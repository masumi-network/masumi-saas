import { NextRequest } from "next/server";

import { listWalletOwnedAgentsForUser } from "@/lib/agents/wallet-ownership";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { agentCountsQuerySchema } from "@/lib/schemas";

import contract from "./route.contract";

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

    const queryResult = agentCountsQuerySchema.safeParse({
      network: request.nextUrl.searchParams.get("network"),
    });
    if (!queryResult.success) {
      return contractJsonResponse(contract, "GET", 400, {
        success: false,
        error: queryResult.error.issues.map((i) => i.message).join("; "),
      });
    }
    const network = queryResult.data.network;
    requireNetworkedOidcApiScope(authContext, {
      resource: "agents",
      action: "read",
      network,
    });

    const agents = await listWalletOwnedAgentsForUser({
      userId: authContext.user.id,
      network,
    });

    const all = agents.length;
    const registered = agents.filter(
      (agent) => agent.registrationState === "RegistrationConfirmed",
    ).length;
    const deregistered = agents.filter(
      (agent) => agent.registrationState === "DeregistrationConfirmed",
    ).length;
    const pending = agents.filter((agent) =>
      ["RegistrationRequested", "DeregistrationRequested"].includes(
        agent.registrationState,
      ),
    ).length;
    const failed = agents.filter((agent) =>
      ["RegistrationFailed", "DeregistrationFailed"].includes(
        agent.registrationState,
      ),
    ).length;
    const verified = agents.filter(
      (agent) => agent.verificationStatus === "VERIFIED",
    ).length;

    return contractJsonResponse(contract, "GET", 200, {
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
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to get agent counts",
    });
  }
}
