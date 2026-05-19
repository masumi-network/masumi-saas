import { createRoute } from "@hono/zod-openapi";
import prisma, { RegistrationState } from "@masumi/database/client";
import { getCookie } from "hono/cookie";

import {
  buildAgentPricing,
  type RegisterAgentParams,
  startAgentRegistration,
} from "@/lib/agent-registration";
import { listWalletOwnedAgentsForUser } from "@/lib/agents/wallet-ownership";
import { shapeAgentWithMergedMetadata } from "@/lib/api/agent-metadata";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  consumeCreditIfRequired,
  createCreditReference,
} from "@/lib/credits/service";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { parseNetwork } from "@/lib/schemas";
import {
  agentsListQuerySchema,
  registerAgentOpenApiBodySchema,
} from "@/lib/schemas/agent";
import { assertAllowedAgentApiUrl } from "@/lib/security/outbound-url";
import {
  agentsListSuccessSchema,
  errBody,
  insufficientCreditsResponse,
  security,
  startRegistrationSuccessSchema,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents");

function matchesAgentSearch(
  agent: {
    name: string;
    description: string | null;
    extendedDescription: string | null;
    apiUrl: string;
    tags: string[];
  },
  search?: string,
): boolean {
  const query = search?.trim().toLowerCase();
  if (!query) return true;

  return (
    agent.name.toLowerCase().includes(query) ||
    agent.description?.toLowerCase().includes(query) === true ||
    agent.extendedDescription?.toLowerCase().includes(query) === true ||
    agent.apiUrl.toLowerCase().includes(query) ||
    agent.tags.some((tag) => tag.toLowerCase().includes(query))
  );
}

function matchesVerificationFilter(
  agent: { verificationStatus: string | null },
  options: {
    verificationStatus?: string | null;
    unverified?: boolean;
  },
): boolean {
  if (options.unverified) {
    return agent.verificationStatus !== "VERIFIED";
  }
  if (options.verificationStatus) {
    return agent.verificationStatus === options.verificationStatus;
  }
  return true;
}

function matchesRegistrationFilter(
  agent: { registrationState: string },
  options: {
    registrationState?: string;
    registrationStateIn?: string | null;
  },
): boolean {
  if (options.registrationStateIn) {
    const states = options.registrationStateIn
      .split(",")
      .map((state) => state.trim())
      .filter(Boolean);
    if (states.length > 0) {
      return states.includes(agent.registrationState);
    }
  }
  if (options.registrationState) {
    return agent.registrationState === options.registrationState;
  }
  return true;
}

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "List agents",
    description:
      "Paginated list of the authenticated user’s agents. Effective **network** filter uses the `network` query param, or the `payment_network` cookie when the query is omitted.",
    security,
    request: {
      query: agentsListQuerySchema,
    },
    responses: {
      200: {
        description: "Agent list",
        content: {
          "application/json": { schema: agentsListSuccessSchema },
        },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw, {
      requireEmailVerified: false,
    });

    const {
      verificationStatus,
      unverified,
      cursor,
      take,
      registrationState,
      registrationStateIn,
      search,
    } = c.req.valid("query");

    try {
      const url = new URL(c.req.url);
      const fromQuery = url.searchParams.get("network");
      const fromCookie = getCookie(c, "payment_network");
      const network = parseNetwork(fromQuery ?? fromCookie ?? undefined);

      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "read",
        network,
      });

      const validStates = new Set(Object.values(RegistrationState) as string[]);
      const normalizedRegistrationStateIn = registrationStateIn
        ? registrationStateIn
            .split(",")
            .map((state) => state.trim())
            .filter((state) => validStates.has(state))
            .join(",")
        : null;
      const normalizedRegistrationState =
        registrationState && validStates.has(registrationState)
          ? registrationState
          : undefined;

      const walletOwnedAgents = await listWalletOwnedAgentsForUser({
        userId: authContext.user.id,
        network,
      });

      const filteredAgents = walletOwnedAgents.filter(
        (agent) =>
          matchesVerificationFilter(agent, {
            verificationStatus,
            unverified,
          }) &&
          matchesRegistrationFilter(agent, {
            registrationState: normalizedRegistrationState,
            registrationStateIn: normalizedRegistrationStateIn,
          }) &&
          matchesAgentSearch(agent, search),
      );

      const startIndex = cursor
        ? filteredAgents.findIndex((agent) => agent.id === cursor) + 1
        : 0;
      const safeStartIndex = startIndex > 0 ? startIndex : 0;
      const page = filteredAgents.slice(safeStartIndex, safeStartIndex + take);
      const hasMore = safeStartIndex + take < filteredAgents.length;
      const nextCursor =
        hasMore && page.length > 0 ? (page[page.length - 1]?.id ?? null) : null;

      // Prisma `verificationStatus`/dates are looser than the OpenAPI response
      // schema. Cast so Hono accepts the response body shape.
      type AgentsListData = z.infer<typeof agentsListSuccessSchema>["data"];
      return c.json(
        {
          success: true as const,
          data: page.map(
            ({ agentReference: _agentReference, ...agent }) => agent,
          ) as unknown as AgentsListData,
          nextCursor,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to get agents:", error);
      throw new ApiError(500, "Failed to get agents");
    }
  },
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Agents"],
    summary: "Start agent registration",
    description:
      "Creates a new agent and begins registration in Masumi SaaS. Returns **400** if `tags` is missing or empty after splitting on commas (at least one tag required).",
    security,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: registerAgentOpenApiBodySchema },
        },
      },
    },
    responses: {
      200: {
        description: "Registration started",
        content: {
          "application/json": { schema: startRegistrationSuccessSchema },
        },
      },
      402: insufficientCreditsResponse,
      503: {
        description: "Payment node unavailable",
        content: { "application/json": { schema: errBody } },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    const authContext = await getAuthenticatedOrThrow(c.req.raw);
    const { user, activeOrganizationId } = authContext;

    const {
      name,
      description,
      extendedDescription,
      apiUrl,
      tags,
      icon,
      pricing,
      termsOfUseUrl,
      privacyPolicyUrl,
      otherUrl,
      capabilityName,
      capabilityVersion,
      exampleOutputs,
    } = c.req.valid("json");

    const tagsArray = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

    if (tagsArray.length === 0) {
      throw new ApiError(400, "At least one tag is required.");
    }

    try {
      const url = new URL(c.req.url);
      const fromQuery = url.searchParams.get("network");
      const fromCookie = getCookie(c, "payment_network");
      const network = parseNetwork(fromQuery ?? fromCookie ?? undefined);

      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "write",
        network,
      });

      try {
        await assertAllowedAgentApiUrl(apiUrl);
      } catch (error) {
        if (error instanceof Error) {
          throw new ApiError(400, error.message);
        }
        throw new ApiError(400, "Invalid API URL");
      }

      const agentPricing = buildAgentPricing(network, pricing ?? undefined);

      await consumeCreditIfRequired({
        userId: user.id,
        reason: "agent_register",
        reference: createCreditReference("agent-register"),
        network,
        metadata: {
          name,
          apiUrl,
          network,
          authMethod: authContext.authMethod,
        },
      });

      const params: RegisterAgentParams = {
        name,
        description: description?.trim() || null,
        extendedDescription: (extendedDescription?.trim() || null) as
          | string
          | null,
        apiUrl,
        tags: tagsArray,
        icon: icon?.trim() || null,
        agentPricing,
        exampleOutputs: exampleOutputs ?? [],
        capabilityName: (capabilityName?.trim() || "Masumi") as string,
        capabilityVersion: (capabilityVersion?.trim() || "1.0") as string,
        termsOfUseUrl: termsOfUseUrl?.trim() || null,
        privacyPolicyUrl: privacyPolicyUrl?.trim() || null,
        otherUrl: otherUrl?.trim() || null,
      };

      const result = await startAgentRegistration(
        {
          user: {
            id: user.id,
            name: user.name ?? null,
            email: user.email ?? null,
          },
          activeOrganizationId,
          network,
        },
        params,
      );

      if (result.success) {
        const agent = await prisma.agent.findFirst({
          where: { id: result.agentId, userId: user.id },
          include: { agentReference: true },
        });
        if (!agent) {
          throw new ApiError(500, "Failed to load created agent");
        }
        const data = shapeAgentWithMergedMetadata(agent);
        // Prisma types are looser than the OpenAPI response schema. Cast.
        type StartRegistrationData = z.infer<
          typeof startRegistrationSuccessSchema
        >["data"];
        return c.json(
          {
            success: true as const,
            data: data as unknown as StartRegistrationData,
            agentId: result.agentId,
          },
          200,
        );
      }
      throw new ApiError(400, result.error);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isPaymentNodeConfigError(error)) {
        throw new ApiError(503, error.message);
      }
      rethrowIfAuthOrCreditsError(error);
      console.error("Failed to register agent:", error);
      throw new ApiError(500, "Failed to register agent");
    }
  },
);

export const { GET, POST } = nextHandlers(app);
export default app;
