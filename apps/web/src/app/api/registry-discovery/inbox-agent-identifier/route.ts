import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  createInboxAdminPaymentNodeClient,
  getRegisteredOwnedInboxAgentReferenceByAgentIdentifier,
} from "@/lib/inbox-agents/server";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { getEffectivePaymentNetwork } from "@/lib/v1-proxy/explicit-route-support";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/registry-discovery/inbox-agent-identifier");

app.get("/", async (c) => {
  const request = c.req.raw;
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const network = getEffectivePaymentNetwork(request);
    requireNetworkedOidcApiScope(authContext, {
      resource: "inbox-agents",
      action: "read",
      network,
    });

    const agentIdentifier = new URL(request.url).searchParams.get(
      "agentIdentifier",
    );
    if (!agentIdentifier) {
      throw new ApiError(400, "agentIdentifier is required");
    }

    const ownedReference =
      await getRegisteredOwnedInboxAgentReferenceByAgentIdentifier({
        userId: authContext.user.id,
        network,
        agentIdentifier,
      });
    if (!ownedReference) {
      throw new ApiError(404, "Inbox agent not found");
    }

    const client = createInboxAdminPaymentNodeClient();
    const metadata = await client.getRegistryInboxByAgentIdentifier({
      agentIdentifier,
      network,
    });
    if (!metadata) {
      throw new ApiError(404, "Inbox agent not found");
    }

    return c.json({ success: true as const, data: metadata }, 200);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isPaymentNodeConfigError(error)) {
      throw new ApiError(503, error.message);
    }
    rethrowIfAuthOrCreditsError(error);
    console.error("[Registry Discovery:inbox-agent-identifier]", error);
    throw new ApiError(500, "Proxy request failed");
  }
});

export const { GET } = nextHandlers(app);
export default app;
