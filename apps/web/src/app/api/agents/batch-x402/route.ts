import { createRoute } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";

import { scheduleAgentRegistrationCompletion } from "@/lib/agents/drive-registration-completion";
import { requireNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { maxAgentRegistrationsForBalance } from "@/lib/credits/agent-registration-quota";
import {
  getCreditBalance,
  InsufficientCreditsError,
} from "@/lib/credits/service";
import { parseNetwork } from "@/lib/schemas";
import {
  insufficientCreditsResponse,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { resourceUrlDuplicateKey } from "@/lib/x402/resource-url-duplicate-key";
import {
  BATCH_X402_REGISTRATION_MAX_URLS,
  findRegisteredX402ResourceUrlKeys,
  startX402HttpAgentRegistration,
} from "@/lib/x402/start-x402-http-agent-registration";
import { z } from "@/lib/zod-openapi";
import { createApiApp } from "@/server/hono/app";
import { ApiError, rethrowIfAuthOrCreditsError } from "@/server/hono/errors";
import { nextHandlers } from "@/server/hono/next";

const batchX402RegistrationItemSchema = z.object({
  resourceUrl: z.string().url().max(2000),
  name: z.string().max(250).optional(),
  description: z.string().max(250).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  icon: z.string().max(250).optional().nullable(),
});

const batchX402BodySchema = z
  .object({
    registrations: z
      .array(batchX402RegistrationItemSchema)
      .min(1)
      .max(BATCH_X402_REGISTRATION_MAX_URLS),
    autofillMetadata: z.boolean().optional(),
    extraTags: z.string().max(500).optional(),
    skipExisting: z.boolean().optional(),
  })
  .openapi({
    example: {
      registrations: [
        {
          resourceUrl: "https://api.example.com/paid-endpoint-a",
          name: "api.example.com · endpoint-a",
          description: "Paid HTTP x402 resource.",
          tags: ["x402", "base"],
        },
        {
          resourceUrl: "https://api.example.com/paid-endpoint-b",
        },
      ],
      autofillMetadata: true,
      skipExisting: true,
    },
  });

const batchX402ResultItemSchema = z.object({
  resourceUrl: z.string(),
  status: z.enum(["started", "skipped_duplicate", "failed", "not_attempted"]),
  agentId: z.string().optional(),
  error: z.string().optional(),
});

const batchX402SuccessSchema = z.object({
  success: z.literal(true),
  results: z.array(batchX402ResultItemSchema),
  summary: z.object({
    started: z.number().int(),
    skippedDuplicate: z.number().int(),
    failed: z.number().int(),
    notAttempted: z.number().int(),
    stoppedReason: z.enum(["insufficient_credits"]).optional(),
  }),
});

const app = createApiApp("/api/agents/batch-x402");

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Agents"],
    summary: "Batch register x402 HTTP resources",
    description:
      "Probes each URL, then starts one Masumi X402 registry agent per resource (same pipeline as single X402 HTTP registration). Processes URLs in order; partial success is allowed.",
    security,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: batchX402BodySchema } },
      },
    },
    responses: {
      200: {
        description: "Batch processed",
        content: {
          "application/json": { schema: batchX402SuccessSchema },
        },
      },
      402: insufficientCreditsResponse,
      ...stdResponses,
    },
  }),
  async (c) => {
    try {
      const authContext = await getAuthenticatedOrThrow(c.req.raw);
      const { user, activeOrganizationId } = authContext;
      const { registrations, autofillMetadata, extraTags, skipExisting } =
        c.req.valid("json");

      const url = new URL(c.req.url);
      const fromQuery = url.searchParams.get("network");
      const fromCookie = getCookie(c, "payment_network");
      const network = parseNetwork(fromQuery ?? fromCookie ?? undefined);

      requireNetworkedOidcApiScope(authContext, {
        resource: "agents",
        action: "write",
        network,
      });

      const extraTagList = extraTags
        ? extraTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

      const dedupedRegistrations: z.infer<
        typeof batchX402RegistrationItemSchema
      >[] = [];
      const seen = new Set<string>();
      for (const item of registrations) {
        const trimmed = item.resourceUrl.trim();
        const key = trimmed.toLowerCase();
        if (!trimmed || seen.has(key)) continue;
        seen.add(key);
        const mergedTags = new Set<string>();
        for (const tag of item.tags ?? []) {
          const t = tag.trim();
          if (t) mergedTags.add(t);
        }
        for (const tag of extraTagList) {
          mergedTags.add(tag);
        }
        dedupedRegistrations.push({
          ...item,
          resourceUrl: trimmed,
          tags: mergedTags.size > 0 ? [...mergedTags] : item.tags,
        });
      }

      if (dedupedRegistrations.length === 0) {
        throw new ApiError(
          400,
          "At least one unique resource URL is required.",
        );
      }

      if (network === "Mainnet") {
        const balance = await getCreditBalance(user.id);
        const affordable = maxAgentRegistrationsForBalance({
          network,
          creditsRemaining: balance.creditsRemaining,
          maxPerBatch: BATCH_X402_REGISTRATION_MAX_URLS,
        });
        if (affordable === 0) {
          throw new InsufficientCreditsError(balance.creditsRemaining);
        }
        let creditConsumingCount = dedupedRegistrations.length;
        if (skipExisting !== false) {
          const registeredKeys = await findRegisteredX402ResourceUrlKeys({
            userId: user.id,
            organizationId: activeOrganizationId,
            network,
            resourceUrls: dedupedRegistrations.map((item) => item.resourceUrl),
          });
          creditConsumingCount = dedupedRegistrations.filter((item) => {
            const key = resourceUrlDuplicateKey(item.resourceUrl);
            return key != null && !registeredKeys.has(key);
          }).length;
        }
        if (creditConsumingCount > affordable) {
          throw new ApiError(
            400,
            `This batch needs ${creditConsumingCount} Mainnet credits (1 per new agent) but you only have ${balance.creditsRemaining}. Reduce new registrations to ${affordable} or fewer.`,
          );
        }
      }

      const ctx = {
        user: {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
        },
        activeOrganizationId,
        network,
      };

      const results: z.infer<typeof batchX402ResultItemSchema>[] = [];
      let started = 0;
      let skippedDuplicate = 0;
      let failed = 0;
      let notAttempted = 0;
      let stoppedReason: "insufficient_credits" | undefined;

      const useProbeMetadataAutofill = autofillMetadata !== false;
      const notAttemptedMessage =
        "Batch stopped: insufficient credits for this registration.";

      for (let i = 0; i < dedupedRegistrations.length; i++) {
        const item = dedupedRegistrations[i]!;
        const outcome = await startX402HttpAgentRegistration({
          ctx,
          resourceUrl: item.resourceUrl,
          name: item.name,
          description: item.description,
          tags: item.tags,
          icon: item.icon ?? undefined,
          skipIfDuplicate: skipExisting !== false,
          authMethod: authContext.authMethod,
          useProbeMetadataAutofill,
        });

        if (outcome.ok) {
          started += 1;
          scheduleAgentRegistrationCompletion(outcome.agentId, user.id);
          results.push({
            resourceUrl: outcome.resourceUrl,
            status: "started",
            agentId: outcome.agentId,
          });
          continue;
        }

        if (outcome.code === "duplicate") {
          skippedDuplicate += 1;
          results.push({
            resourceUrl: outcome.resourceUrl,
            status: "skipped_duplicate",
            error: outcome.error,
          });
          continue;
        }

        failed += 1;
        results.push({
          resourceUrl: outcome.resourceUrl,
          status: "failed",
          error: outcome.error,
        });

        if (outcome.code === "credits") {
          stoppedReason = "insufficient_credits";
          for (const remaining of dedupedRegistrations.slice(i + 1)) {
            notAttempted += 1;
            results.push({
              resourceUrl: remaining.resourceUrl,
              status: "not_attempted",
              error: notAttemptedMessage,
            });
          }
          break;
        }
      }

      if (started === 0 && stoppedReason === "insufficient_credits") {
        throw new InsufficientCreditsError(0);
      }

      return c.json(
        {
          success: true as const,
          results,
          summary: {
            started,
            skippedDuplicate,
            failed,
            notAttempted,
            ...(stoppedReason ? { stoppedReason } : {}),
          },
        },
        200,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      rethrowIfAuthOrCreditsError(error);
      console.error("batch x402 registration failed:", error);
      throw new ApiError(500, "Failed to batch register x402 resources");
    }
  },
);

export const POST = nextHandlers(app).POST;
