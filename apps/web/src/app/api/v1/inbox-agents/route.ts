import { createRoute } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";

import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  consumeCreditIfRequired,
  createCreditReference,
  refundConsumedCredit,
} from "@/lib/credits/service";
import {
  createInboxAdminPaymentNodeClient,
  deleteInboxAgentReference,
  finalizeInboxAgentReservation,
  findInboxAgentSlugConflict,
  findRegistryInboxAgentSlugConflict,
  INBOX_AGENT_DUPLICATE_SLUG_ERROR,
  INBOX_AGENT_OWNERSHIP_CONFLICT_ERROR,
  isInboxAgentOwnershipMismatchError,
  isStaleInboxAgentCursorError,
  listOwnedInboxAgentsForUser,
  prepareManagedInboxRegistration,
  reserveInboxAgentReference,
} from "@/lib/inbox-agents/server";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { parseNetwork } from "@/lib/schemas";
import {
  getCanonicalInboxAgentSlug,
  inboxAgentsListQuerySchema,
  validateCanonicalInboxAgentSlug,
} from "@/lib/schemas/inbox-agent";
import {
  errBody,
  inboxAgentMutationSuccessSchema,
  inboxAgentRegisterConflictBody,
  inboxAgentsListSuccessSchema,
  insufficientCreditsResponse,
  registerInboxAgentOpenApiBodySchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

export const routeMeta = { documents: ["platform"] as const };

const app = createApiApp("/api/v1/inbox-agents");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Inbox agents"],
    summary: "List inbox agents",
    description:
      "Paginated list of the authenticated user’s inbox-agent registrations. Effective `network` comes from the query param or the `payment_network` cookie. Continue pagination only with the same `network`, `filterStatus`, and `search`; changing any of them requires restarting without `cursor`, otherwise the endpoint may return HTTP 410.",
    security,
    request: { query: inboxAgentsListQuerySchema },
    responses: {
      200: {
        description: "Inbox-agent list",
        content: {
          "application/json": { schema: inboxAgentsListSuccessSchema },
        },
      },
      410: {
        description: "Stale cursor",
        content: { "application/json": { schema: errBody } },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    try {
      const authContext = await getAuthenticatedOrThrow(c.req.raw, {
        requireEmailVerified: false,
      });

      const queryValues = c.req.valid("query");
      const network =
        queryValues.network ??
        // inboxAgentsListQuerySchema may apply network coercion that returns null
        // for unknown values; fall back to the cookie when missing
        ((): "Preprod" | "Mainnet" => {
          const cookieNetwork = getCookie(c, "payment_network");
          return cookieNetwork === "Mainnet" ? "Mainnet" : "Preprod";
        })();

      requireNetworkedOidcApiScope(authContext, {
        resource: "inbox-agents",
        action: "read",
        network,
      });

      const { cursor, filterStatus, search, take } = queryValues;

      const { Assets, nextCursor } = await listOwnedInboxAgentsForUser({
        userId: authContext.user.id,
        network,
        take,
        cursor,
        filterStatus,
        search,
      });

      return c.json(
        {
          success: true as const,
          data: Assets as unknown as z.infer<
            typeof inboxAgentsListSuccessSchema
          >["data"],
          nextCursor,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isStaleInboxAgentCursorError(error)) {
        throw new ApiError(410, error.message);
      }
      const authResponse = handleAuthError(error);
      if (authResponse) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return authResponse as any;
      }
      console.error("Failed to get inbox agents:", error);
      throw new ApiError(500, "Failed to get inbox agents");
    }
  },
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Inbox agents"],
    summary: "Register inbox agent",
    description:
      "Registers a new inbox agent after normalizing the slug. A configured server-side executing wallet pays for the registration and receives the registration asset; ownership is tracked locally for the authenticated user. Returns HTTP 409 when the slug is already in use on the selected network, or when the finalized registration resolves to another user's existing ownership record.",
    security,
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: registerInboxAgentOpenApiBodySchema },
        },
      },
    },
    responses: {
      200: {
        description: "Inbox-agent registration created",
        content: {
          "application/json": { schema: inboxAgentMutationSuccessSchema },
        },
      },
      402: insufficientCreditsResponse,
      409: {
        description: "Inbox registration conflict",
        content: {
          "application/json": { schema: inboxAgentRegisterConflictBody },
        },
      },
      503: {
        description: "Payment node unavailable",
        content: { "application/json": { schema: errBody } },
      },
      ...stdResponses,
    },
  }),
  async (c) => {
    let creditRefund: (() => Promise<void>) | null = null;
    let reservationId: string | null = null;
    const cleanupReservation = async () => {
      if (!reservationId) return;
      const pendingReservationId = reservationId;
      reservationId = null;
      await deleteInboxAgentReference(pendingReservationId).catch(() => {});
    };
    const refundCreditAndCleanupReservation = async () => {
      const refund = creditRefund;
      creditRefund = null;
      try {
        if (refund) await refund();
      } finally {
        await cleanupReservation();
      }
    };

    try {
      const authContext = await getAuthenticatedOrThrow(c.req.raw);
      const network = parseNetwork(
        new URL(c.req.url).searchParams.get("network") ??
          getCookie(c, "payment_network") ??
          undefined,
      );
      requireNetworkedOidcApiScope(authContext, {
        resource: "inbox-agents",
        action: "write",
        network,
      });

      const validation = { data: c.req.valid("json") };

      const canonicalSlug = getCanonicalInboxAgentSlug(
        validation.data.agentSlug,
      );
      const slugValidationError =
        validateCanonicalInboxAgentSlug(canonicalSlug);
      if (slugValidationError) {
        throw new ApiError(400, slugValidationError);
      }

      const userPaymentNodeClient = await getPaymentNodeClientForUser(
        authContext.user.id,
      );
      if (!userPaymentNodeClient) {
        throw new ApiError(403, "Payment node not configured for user");
      }

      const client = createInboxAdminPaymentNodeClient();
      const localSlugConflict = await findInboxAgentSlugConflict({
        network,
        slug: canonicalSlug,
        client,
      });
      if (localSlugConflict) {
        throw new ApiError(409, INBOX_AGENT_DUPLICATE_SLUG_ERROR);
      }

      const registrySlugConflict = await findRegistryInboxAgentSlugConflict({
        network,
        slug: canonicalSlug,
        client,
      });
      if (registrySlugConflict) {
        throw new ApiError(409, INBOX_AGENT_DUPLICATE_SLUG_ERROR);
      }

      const managedRegistration = await prepareManagedInboxRegistration({
        name: validation.data.name.trim(),
        network,
      });
      if (!managedRegistration.success) {
        throw new ApiError(400, managedRegistration.error);
      }

      const reservationResult = await reserveInboxAgentReference({
        userId: authContext.user.id,
        network,
        name: validation.data.name.trim(),
        description: validation.data.description?.trim() || null,
        slug: canonicalSlug,
        executingWallet: managedRegistration.executingWallet,
        smartContractAddress: managedRegistration.smartContractAddress,
      });
      if (reservationResult.status === "conflict") {
        throw new ApiError(409, INBOX_AGENT_DUPLICATE_SLUG_ERROR);
      }
      reservationId = reservationResult.reservation.id;

      const creditReference = createCreditReference("inbox-agent-register");
      const creditMetadata = {
        name: validation.data.name.trim(),
        agentSlug: canonicalSlug,
        network,
        authMethod: authContext.authMethod,
      };
      await consumeCreditIfRequired({
        userId: authContext.user.id,
        reason: "inbox_agent_register",
        reference: creditReference,
        network,
        metadata: creditMetadata,
      });
      creditRefund = () =>
        refundConsumedCredit({
          userId: authContext.user.id,
          reason: "inbox_agent_register",
          reference: creditReference,
          network,
          metadata: creditMetadata,
        });

      const created = await client.registerInboxAgent({
        network,
        sellingWalletVkey: managedRegistration.executingWallet.walletVkey,
        recipientWalletAddress:
          managedRegistration.executingWallet.walletAddress,
        name: validation.data.name.trim(),
        description: validation.data.description?.trim() || undefined,
        agentSlug: canonicalSlug,
      });

      try {
        await finalizeInboxAgentReservation({
          reservationId,
          userId: authContext.user.id,
          network,
          entry: created,
          executingWallet: managedRegistration.executingWallet,
          smartContractAddress: managedRegistration.smartContractAddress,
        });
      } catch (error) {
        if (isInboxAgentOwnershipMismatchError(error)) {
          console.error(
            "[Inbox Agents] Registered inbox collides with another user's ownership record; leaving remote entry intact:",
            {
              inboxAgentId: created.id,
              attemptedUserId: authContext.user.id,
              ownedByUserId: error.ownedByUserId,
            },
          );
          await refundCreditAndCleanupReservation();
          throw new ApiError(409, INBOX_AGENT_OWNERSHIP_CONFLICT_ERROR);
        }

        console.error(
          "[Inbox Agents] Failed to persist created ownership record:",
          {
            inboxAgentId: created.id,
            userId: authContext.user.id,
            error,
          },
        );

        try {
          await client.deleteRegistryInboxEntry(created.id);
        } catch (cleanupError) {
          console.error(
            "[Inbox Agents] Failed to clean up inbox registration after ownership persistence failed:",
            {
              inboxAgentId: created.id,
              userId: authContext.user.id,
              error: cleanupError,
            },
          );
        }

        await refundCreditAndCleanupReservation();
        throw new ApiError(500, "Failed to persist inbox agent ownership");
      }

      creditRefund = null;
      reservationId = null;
      return c.json(
        {
          success: true as const,
          data: created as unknown as z.infer<
            typeof inboxAgentMutationSuccessSchema
          >["data"],
        },
        200,
      );
    } catch (error) {
      let cleanupError: unknown = null;
      try {
        await refundCreditAndCleanupReservation();
      } catch (cleanupFailure) {
        cleanupError = cleanupFailure;
      }
      if (error instanceof ApiError) throw error;
      if (isPaymentNodeConfigError(error)) {
        throw new ApiError(503, error.message);
      }
      const authResponse = handleAuthError(error);
      if (authResponse) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return authResponse as any;
      }
      if (cleanupError) {
        console.error(
          "[Inbox Agents] Failed to refund consumed credit during registration cleanup:",
          cleanupError,
        );
      }
      console.error("Failed to register inbox agent:", error);
      throw new ApiError(500, "Failed to register inbox agent");
    }
  },
);

export const { GET, POST } = nextHandlers(app);
export default app;
