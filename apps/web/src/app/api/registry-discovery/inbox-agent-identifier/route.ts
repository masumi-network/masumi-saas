import { NextRequest } from "next/server";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  createInboxAdminPaymentNodeClient,
  getRegisteredOwnedInboxAgentReferenceByAgentIdentifier,
} from "@/lib/inbox-agents/server";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { getEffectivePaymentNetwork } from "@/lib/v1-proxy/explicit-route-support";
import { createApiApp } from "@/server/hono/app";
import { rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/registry-discovery/inbox-agent-identifier");

app.get("/", async (c) => {
  const request = new NextRequest(c.req.raw);
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

    const agentIdentifier = request.nextUrl.searchParams.get("agentIdentifier");
    if (!agentIdentifier) {
      return c.json(
        { success: false as const, error: "agentIdentifier is required" },
        400,
      );
    }

    const ownedReference =
      await getRegisteredOwnedInboxAgentReferenceByAgentIdentifier({
        userId: authContext.user.id,
        network,
        agentIdentifier,
      });
    if (!ownedReference) {
      return c.json(
        { success: false as const, error: "Inbox agent not found" },
        404,
      );
    }

    const client = createInboxAdminPaymentNodeClient();
    const metadata = await client.getRegistryInboxByAgentIdentifier({
      agentIdentifier,
      network,
    });
    if (!metadata) {
      return c.json(
        { success: false as const, error: "Inbox agent not found" },
        404,
      );
    }

    return c.json({ success: true as const, data: metadata }, 200);
  } catch (error) {
    if (isPaymentNodeConfigError(error)) {
      return c.json({ success: false as const, error: error.message }, 503);
    }
    rethrowIfAuthOrCreditsError(error);
    console.error("[Registry Discovery:inbox-agent-identifier]", error);
    return c.json(
      { success: false as const, error: "Proxy request failed" },
      500,
    );
  }
});

export const { GET } = nextHandlers(app);
export default app;
