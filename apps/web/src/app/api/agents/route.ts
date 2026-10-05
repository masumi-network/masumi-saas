import { randomUUID } from "node:crypto";

import { createRoute } from "@hono/zod-openapi";
import prisma, { RegistrationState } from "@masumi/database/client";
import { loadSupportedPaymentSourcesMap } from "@masumi/payment-source-x402/supported-payment-sources";
import { getCookie } from "hono/cookie";

import {
  buildAgentPricing,
  type RegisterAgentParams,
  startAgentRegistration,
  validateAgentRegistrationPaymentSourcesPreflight,
} from "@/lib/agent-registration";
import {
  type AgentPricingTypeFilter,
  type AgentRegistrationKindFilter,
  matchesAgentTypeFilter,
  matchesPricingTypeFilter,
} from "@/lib/agents/agent-list-filter-match";
import { scheduleAgentRegistrationCompletion } from "@/lib/agents/drive-registration-completion";
import { canRefundCreditAfterRegistrationThrow } from "@/lib/agents/registration-credit-refund";
import { listWalletOwnedAgentsForUser } from "@/lib/agents/wallet-ownership";
import { shapeAgentForApi } from "@/lib/api/agent-metadata";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { assertMainnetCreditsForNewRegistrations } from "@/lib/credits/apply-mainnet-registration-credit-gate";
import {
  consumeCreditIfRequired,
  createCreditReference,
  refundConsumedCredit,
} from "@/lib/credits/service";
import {
  createIntegrationConnection,
  decryptIntegrationConnectionSecret,
  getScopedIntegrationConnection,
} from "@/lib/integrations/connections";
import {
  langdockInputFieldsToMipSchema,
  testLangdockAgent,
} from "@/lib/integrations/langdock";
import { getPublicMipAgentBaseUrl } from "@/lib/mip/public-url";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { validatePayoutAddressForNetwork } from "@/lib/payment-node/payout-address";
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
import { prepareX402HttpRegistration } from "@/lib/x402/prepare-http-registration";
import { findExistingX402HttpAgentByResourceUrl } from "@/lib/x402/start-x402-http-agent-registration";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const app = createApiApp("/api/agents");

function matchesAgentSearch(
  agent: {
    name: string;
    description: string | null;
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
      agentType,
      pricingType,
      search,
      network: networkQuery,
    } = c.req.valid("query");

    try {
      const fromCookie = getCookie(c, "payment_network");
      const network = parseNetwork(networkQuery ?? fromCookie ?? undefined);

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
          matchesAgentTypeFilter(
            agent,
            agentType as AgentRegistrationKindFilter | undefined,
          ) &&
          matchesPricingTypeFilter(
            agent,
            pricingType as AgentPricingTypeFilter | undefined,
          ) &&
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

      const sourcesByAgentId = await loadSupportedPaymentSourcesMap(
        page.map((agent) => agent.id),
      );

      // Prisma `verificationStatus`/dates are looser than the OpenAPI response
      // schema. Cast so Hono accepts the response body shape.
      type AgentsListData = z.infer<typeof agentsListSuccessSchema>["data"];
      return c.json(
        {
          success: true as const,
          data: page.map((agent) => {
            const { agentReference: _agentReference, ...rest } = agent;
            return shapeAgentForApi(
              agent,
              sourcesByAgentId.get(agent.id) ?? null,
            );
          }) as unknown as AgentsListData,
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
      apiUrl,
      registrationKind,
      x402ResourceUrl,
      runtimeProvider,
      integrationConnectionId,
      langdockApiKey,
      langdockAgentId,
      langdockBaseUrl,
      tags,
      icon,
      pricing,
      termsOfUseUrl,
      privacyPolicyUrl,
      otherUrl,
      capabilityName,
      capabilityVersion,
      exampleOutputs,
      supportedPaymentSources,
      payoutAddress,
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

      const isX402HttpRegistration = registrationKind === "X402_HTTP";
      let x402Manifest: RegisterAgentParams["x402Manifest"];
      let x402CanonicalResourceUrl: string | undefined;
      let resolvedSupportedPaymentSources = supportedPaymentSources;

      if (isX402HttpRegistration) {
        const resource = x402ResourceUrl?.trim() ?? "";
        if (!resource) {
          throw new ApiError(400, "x402 resource URL is required.");
        }
        try {
          await assertAllowedAgentApiUrl(resource);
        } catch (error) {
          if (error instanceof Error) {
            throw new ApiError(400, error.message);
          }
          throw new ApiError(400, "Invalid x402 resource URL");
        }
        const prepared = await prepareX402HttpRegistration({
          resourceUrl: resource,
          network,
        });
        if (!prepared.ok) {
          throw new ApiError(400, prepared.error);
        }
        x402Manifest = prepared.data.x402Manifest;
        x402CanonicalResourceUrl = prepared.data.resourceUrl;
        resolvedSupportedPaymentSources = prepared.data.supportedPaymentSources;

        const existingX402 = await findExistingX402HttpAgentByResourceUrl({
          userId: user.id,
          organizationId: activeOrganizationId,
          network,
          resourceUrl: x402CanonicalResourceUrl,
        });
        if (existingX402) {
          throw new ApiError(
            409,
            "An agent for this resource URL is already registered.",
          );
        }
      }

      const selectedRuntimeProvider = isX402HttpRegistration
        ? "DIRECT_MIP"
        : (runtimeProvider ?? "DIRECT_MIP");
      let resolvedApiUrl = apiUrl?.trim() ?? "";
      let resolvedIntegrationConnectionId: string | null = null;
      let providerConfig: Record<string, unknown> | null = null;
      let agentId: string | undefined;

      if (isX402HttpRegistration) {
        resolvedApiUrl = x402CanonicalResourceUrl ?? "";
      } else if (selectedRuntimeProvider === "DIRECT_MIP") {
        if (!resolvedApiUrl) {
          throw new ApiError(400, "API URL is required.");
        }
        try {
          await assertAllowedAgentApiUrl(resolvedApiUrl);
        } catch (error) {
          if (error instanceof Error) {
            throw new ApiError(400, error.message);
          }
          throw new ApiError(400, "Invalid API URL");
        }
      } else {
        if (!langdockAgentId?.trim()) {
          throw new ApiError(400, "Langdock agent ID is required.");
        }
        const scope = {
          userId: user.id,
          organizationId: activeOrganizationId,
        };
        let secret = langdockApiKey?.trim() ?? "";
        let connectionMetadata: Record<string, unknown> = {};

        if (integrationConnectionId) {
          const connection = await getScopedIntegrationConnection({
            scope,
            id: integrationConnectionId,
          });
          if (!connection || connection.provider !== "LANGDOCK") {
            throw new ApiError(404, "Langdock connection not found.");
          }
          secret = await decryptIntegrationConnectionSecret(connection);
          resolvedIntegrationConnectionId = connection.id;
          connectionMetadata =
            connection.metadata && typeof connection.metadata === "object"
              ? (connection.metadata as Record<string, unknown>)
              : {};
        }

        if (!secret) {
          throw new ApiError(400, "Langdock API key is required.");
        }

        const resolvedLangdockBaseUrl =
          langdockBaseUrl?.trim() ||
          (typeof connectionMetadata.baseUrl === "string"
            ? connectionMetadata.baseUrl.trim()
            : undefined);

        let langdockAgent;
        try {
          langdockAgent = await testLangdockAgent({
            apiKey: secret,
            agentId: langdockAgentId.trim(),
            baseUrl: resolvedLangdockBaseUrl || undefined,
          });
        } catch (error) {
          throw new ApiError(
            400,
            error instanceof Error
              ? error.message
              : "Langdock connection check failed.",
          );
        }

        if (!resolvedIntegrationConnectionId) {
          const connection = await createIntegrationConnection({
            scope,
            provider: "LANGDOCK",
            name: "Langdock",
            secret,
            metadata: {
              ...connectionMetadata,
              baseUrl: resolvedLangdockBaseUrl || undefined,
              lastAgentId: langdockAgentId.trim(),
              lastCheckedAt: new Date().toISOString(),
            },
          });
          resolvedIntegrationConnectionId = connection.id;
        }

        agentId = randomUUID();
        resolvedApiUrl = getPublicMipAgentBaseUrl(agentId);
        providerConfig = {
          langdockAgentId: langdockAgentId.trim(),
          langdockBaseUrl: resolvedLangdockBaseUrl || undefined,
          inputSchema: langdockInputFieldsToMipSchema(
            langdockAgent.inputFields,
          ),
          hitl: true,
        };
      }

      let agentPricing: ReturnType<typeof buildAgentPricing>;
      try {
        agentPricing = isX402HttpRegistration
          ? { pricingType: "Free" as const }
          : buildAgentPricing(network, pricing ?? undefined);
      } catch (error) {
        // An unparseable fixed price is a client input error, not a 500.
        throw new ApiError(
          400,
          error instanceof Error ? error.message : "Invalid agent pricing",
        );
      }

      if (!isX402HttpRegistration) {
        if (
          agentPricing.pricingType === "Free" &&
          resolvedSupportedPaymentSources &&
          resolvedSupportedPaymentSources.length > 0
        ) {
          throw new ApiError(
            400,
            "Free agents cannot include x402 payment options.",
          );
        }

        if (
          agentPricing.pricingType === "Dynamic" &&
          resolvedSupportedPaymentSources &&
          resolvedSupportedPaymentSources.length > 0
        ) {
          throw new ApiError(
            400,
            "Dynamic pricing agents cannot include x402 payment options.",
          );
        }
      }

      const paymentSourcesPreflight =
        await validateAgentRegistrationPaymentSourcesPreflight(
          network,
          resolvedSupportedPaymentSources,
          agentPricing,
        );
      if (!paymentSourcesPreflight.ok) {
        throw new ApiError(400, paymentSourcesPreflight.error);
      }

      // Validate the payout address format BEFORE consuming a credit. The
      // registration path re-validates (defense in depth), but validating here
      // avoids burning the user's credit on a malformed address that would only
      // fail later with no refund path.
      if (agentPricing.pricingType !== "Free") {
        const payoutAddressError = validatePayoutAddressForNetwork(
          payoutAddress?.trim() ?? "",
          network,
        );
        if (payoutAddressError) {
          throw new ApiError(400, payoutAddressError);
        }
      }

      await assertMainnetCreditsForNewRegistrations({
        userId: user.id,
        network,
        registrationsNeeded: 1,
      });

      const creditReference = createCreditReference("agent-register");
      const creditMetadata = {
        name,
        apiUrl: resolvedApiUrl,
        network,
        authMethod: authContext.authMethod,
        runtimeProvider: selectedRuntimeProvider,
      };

      await consumeCreditIfRequired({
        userId: user.id,
        reason: "agent_register",
        reference: creditReference,
        network,
        metadata: creditMetadata,
      });

      // Fix the id up front so a throw can tell whether the agent was persisted.
      const registrationAgentId = agentId ?? randomUUID();

      const params: RegisterAgentParams = {
        id: registrationAgentId,
        name,
        description: description?.trim() || null,
        apiUrl: resolvedApiUrl,
        runtimeProvider: selectedRuntimeProvider,
        integrationConnectionId: resolvedIntegrationConnectionId,
        providerConfig,
        tags: tagsArray,
        icon: icon?.trim() || null,
        agentPricing,
        exampleOutputs: exampleOutputs ?? [],
        capabilityName: (capabilityName?.trim() || "Masumi") as string,
        capabilityVersion: (capabilityVersion?.trim() || "1.0") as string,
        termsOfUseUrl: termsOfUseUrl?.trim() || null,
        privacyPolicyUrl: privacyPolicyUrl?.trim() || null,
        otherUrl: otherUrl?.trim() || null,
        supportedPaymentSources: resolvedSupportedPaymentSources,
        payoutAddress: payoutAddress?.trim() ?? "",
        ...(isX402HttpRegistration && x402Manifest
          ? {
              registryEntryType: "X402" as const,
              x402Manifest,
            }
          : {}),
      };

      let result: Awaited<ReturnType<typeof startAgentRegistration>>;
      try {
        result = await startAgentRegistration(
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
      } catch (registrationError) {
        if (await canRefundCreditAfterRegistrationThrow(registrationAgentId)) {
          await refundConsumedCredit({
            userId: user.id,
            reason: "agent_register",
            reference: creditReference,
            network,
            metadata: creditMetadata,
          });
        }
        throw registrationError;
      }

      if (!result.success) {
        await refundConsumedCredit({
          userId: user.id,
          reason: "agent_register",
          reference: creditReference,
          network,
          metadata: creditMetadata,
        });
        throw new ApiError(400, result.error);
      }

      scheduleAgentRegistrationCompletion(result.agentId, user.id);
      const agent = await prisma.agent.findFirst({
        where: { id: result.agentId, userId: user.id },
        include: { agentReference: true },
      });
      if (!agent) {
        throw new ApiError(500, "Failed to load created agent");
      }
      const sourcesByAgentId = await loadSupportedPaymentSourcesMap([agent.id]);
      const data = shapeAgentForApi(
        agent,
        sourcesByAgentId.get(agent.id) ?? null,
      );
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
