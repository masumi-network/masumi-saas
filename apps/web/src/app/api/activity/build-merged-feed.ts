import { createHash } from "node:crypto";

import prisma from "@masumi/database/client";
import { unstable_cache } from "next/cache";

import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { formatRequestedAmount } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import type { ActivityFeedFilter } from "@/lib/schemas/activity";
import type { NetworkQuery } from "@/lib/schemas/api-query";
import type { ActivityFeedItem } from "@/lib/types/activity";

/** Max items merged for the feed (lifecycle + payments/purchases) before response. */
export const ACTIVITY_MERGED_FEED_LIMIT = 200;

/**
 * Short TTL so paginated "load more" reuses one merged snapshot without repeating
 * payment-node list calls on every cursor request. Trade-off: feed can lag briefly.
 */
const MERGED_FEED_CACHE_REVALIDATE_SECONDS = 12;

/** Stable int32 pair for Postgres advisory lock (cross-instance, unlike in-memory Maps). */
function userIdToAdvisoryLockKeys(userId: string): [number, number] {
  const buf = createHash("sha256").update(userId, "utf8").digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

/**
 * One-time seed of lifecycle rows when the user has agents but no events yet.
 * Runs **outside** `unstable_cache` (writes must not run inside the Data Cache) and uses
 * `pg_advisory_xact_lock` so serverless concurrency does not double-insert.
 */
async function maybeBackfillAgentLifecycleEvents(params: {
  userId: string;
  network: NetworkQuery;
}): Promise<void> {
  const { userId, network } = params;
  const agents = await prisma.agent.findMany({
    where: {
      userId,
      OR: [{ networkIdentifier: network }, { networkIdentifier: null }],
    },
    select: {
      id: true,
      name: true,
      networkIdentifier: true,
      registrationState: true,
      verificationStatus: true,
    },
  });
  if (agents.length === 0) return;
  const agentIds = agents.map((a) => a.id);
  const anyEvent = await prisma.agentActivityEvent.findFirst({
    where: { agentId: { in: agentIds } },
    select: { id: true },
  });
  if (anyEvent) return;

  const [k1, k2] = userIdToAdvisoryLockKeys(userId);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${k1}::integer, ${k2}::integer)`;
      const recheck = await tx.agentActivityEvent.findFirst({
        where: { agentId: { in: agentIds } },
        select: { id: true },
      });
      if (recheck) return;
      for (const agent of agents) {
        const stateEventType = registrationStateToEventType(
          agent.registrationState,
        );
        if (stateEventType) {
          await tx.agentActivityEvent.create({
            data: {
              agentId: agent.id,
              userId,
              type: stateEventType,
              agentNameSnapshot: agent.name,
              networkIdentifier: agent.networkIdentifier,
            },
          });
        }
        if (agent.verificationStatus === "VERIFIED") {
          await tx.agentActivityEvent.create({
            data: {
              agentId: agent.id,
              userId,
              type: "AgentVerified",
              agentNameSnapshot: agent.name,
              networkIdentifier: agent.networkIdentifier,
            },
          });
        }
      }
    });
  } catch (err) {
    console.error("[Activity] Backfill transaction failed:", userId, err);
  }
}

function registrationStateToEventType(
  state: string,
):
  | "RegistrationInitiated"
  | "RegistrationConfirmed"
  | "RegistrationFailed"
  | "DeregistrationRequested"
  | "DeregistrationConfirmed"
  | null {
  switch (state) {
    case "RegistrationRequested":
    case "RegistrationInitiated":
      return "RegistrationInitiated";
    case "RegistrationConfirmed":
      return "RegistrationConfirmed";
    case "RegistrationFailed":
      return "RegistrationFailed";
    case "DeregistrationRequested":
    case "DeregistrationInitiated":
      return "DeregistrationRequested";
    case "DeregistrationConfirmed":
      return "DeregistrationConfirmed";
    case "DeregistrationFailed":
      return null;
    default:
      return null;
  }
}

export type ActivityMergedFeedResult = {
  merged: ActivityFeedItem[];
  transactionLastUpdate?: string;
};

type BuildMergedFeedParams = {
  userId: string;
  network: NetworkQuery;
  validFilter: ActivityFeedFilter;
  lastUpdate: string | undefined;
};

async function buildActivityMergedFeedUncached({
  userId,
  network,
  validFilter,
  lastUpdate,
}: BuildMergedFeedParams): Promise<ActivityMergedFeedResult> {
  /** Selected network plus legacy rows with no network (pre-migration / incomplete data). */
  const agents = await prisma.agent.findMany({
    where: {
      userId,
      OR: [{ networkIdentifier: network }, { networkIdentifier: null }],
    },
    select: {
      id: true,
      name: true,
      agentIdentifier: true,
      networkIdentifier: true,
      registrationState: true,
      verificationStatus: true,
    },
  });

  const agentByIdentifier = new Map(
    agents
      .filter((a) => a.agentIdentifier)
      .map((a) => [a.agentIdentifier!, a] as const),
  );

  const needLifecycle = validFilter === "all" || validFilter === "lifecycle";

  let lifecycleItems: ActivityFeedItem[] = [];

  if (needLifecycle) {
    const agentIds = agents.map((a) => a.id);
    const [eventsForAgents, orphanEvents] = await Promise.all([
      prisma.agentActivityEvent.findMany({
        where: { agentId: { in: agentIds } },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_MERGED_FEED_LIMIT,
        include: { agent: { select: { id: true, name: true } } },
      }),
      prisma.agentActivityEvent.findMany({
        where: {
          userId,
          agentId: null,
          OR: [{ networkIdentifier: network }, { networkIdentifier: null }],
        },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_MERGED_FEED_LIMIT,
        include: { agent: { select: { id: true, name: true } } },
      }),
    ]);
    const events = [...eventsForAgents, ...orphanEvents]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, ACTIVITY_MERGED_FEED_LIMIT);

    lifecycleItems = events.map((e) => ({
      kind: "lifecycle" as const,
      id: e.id,
      date: e.createdAt.toISOString(),
      type: e.type,
      agentId: e.agent?.id ?? null,
      agentName: e.agent?.name ?? e.agentNameSnapshot ?? null,
    }));
  }

  /** Non-empty client watermark → payment-node diff endpoints (polling); otherwise full list. */
  const transactionWatermark =
    lastUpdate !== undefined && lastUpdate.length > 0 ? lastUpdate : null;
  const needTransactions = validFilter !== "lifecycle";

  let transactionItems: ActivityFeedItem[] = [];
  let transactionLastUpdate: string | undefined;

  if (!needTransactions) {
    // Lifecycle-only filter: merged feed is DB lifecycle events only (no payment-node I/O).
  } else {
    try {
      const client = await getPaymentNodeClientForUser(userId);
      if (!client) {
        // No payment-node client for this user yet — transaction rows stay empty; lifecycle still merges below.
      } else {
        const smartContractAddress =
          await getSmartContractAddressForConfiguredSource(client, userId);
        const agentIdentifiers = new Set(
          agents.map((a) => a.agentIdentifier).filter(Boolean) as string[],
        );
        if (!smartContractAddress || agentIdentifiers.size === 0) {
          // Cannot list or attribute on-chain txs without a resolved contract and agent registry ids.
        } else {
          const listLimit = 100;
          const diffLimit = 100;
          const [paymentsRes, purchasesRes] =
            transactionWatermark !== null
              ? await Promise.all([
                  client.listPaymentDiff({
                    network,
                    filterSmartContractAddress: smartContractAddress,
                    lastUpdate: transactionWatermark,
                    limit: diffLimit,
                  }),
                  client.listPurchaseDiff({
                    network,
                    filterSmartContractAddress: smartContractAddress,
                    lastUpdate: transactionWatermark,
                    limit: diffLimit,
                  }),
                ])
              : await Promise.all([
                  client.listPayments({
                    network,
                    filterSmartContractAddress: smartContractAddress,
                    limit: listLimit,
                  }),
                  client.listPurchases({
                    network,
                    filterSmartContractAddress: smartContractAddress,
                    limit: listLimit,
                  }),
                ]);
          const payments = (paymentsRes.Payments ?? []).filter(
            (p: PaymentOrPurchaseItem) =>
              p.agentIdentifier
                ? agentIdentifiers.has(p.agentIdentifier)
                : false,
          );
          const purchases = (purchasesRes.Purchases ?? []).filter(
            (p: PaymentOrPurchaseItem) =>
              p.agentIdentifier
                ? agentIdentifiers.has(p.agentIdentifier)
                : false,
          );
          const toItem = (
            p: PaymentOrPurchaseItem,
            type: "payment" | "purchase",
          ): ActivityFeedItem => {
            const agent = p.agentIdentifier
              ? agentByIdentifier.get(p.agentIdentifier)
              : null;
            const status =
              p.onChainState ??
              (
                p as PaymentOrPurchaseItem & {
                  NextAction?: { requestedAction?: string };
                }
              ).NextAction?.requestedAction ??
              "—";
            return {
              kind: "transaction",
              id: p.id,
              date: p.createdAt,
              type,
              agentId: agent?.id ?? null,
              agentName: agent?.name ?? null,
              amount: formatRequestedAmount(p.RequestedFunds),
              status: String(status),
              txHash: p.CurrentTransaction?.txHash ?? null,
            };
          };
          transactionItems = [
            ...payments.map((p: PaymentOrPurchaseItem) => toItem(p, "payment")),
            ...purchases.map((p: PaymentOrPurchaseItem) =>
              toItem(p, "purchase"),
            ),
          ];
          const lastChangedFields = [...payments, ...purchases].map(
            (p: PaymentOrPurchaseItem) =>
              p.nextActionOrOnChainStateOrResultLastChangedAt ??
              p.updatedAt ??
              p.createdAt,
          );
          transactionLastUpdate =
            lastChangedFields.length > 0
              ? lastChangedFields.reduce((a, b) => (a > b ? a : b))
              : lastUpdate;
        }
      }
    } catch (txError) {
      console.error("[Activity] Payment node / transactions error:", txError);
    }
  }

  let merged: ActivityFeedItem[] = [...lifecycleItems, ...transactionItems];
  if (validFilter === "lifecycle") {
    merged = merged.filter((i) => i.kind === "lifecycle");
  } else if (validFilter === "transactions") {
    merged = merged.filter((i) => i.kind === "transaction");
  } else if (validFilter === "purchases") {
    merged = merged.filter(
      (i) => i.kind === "transaction" && i.type === "purchase",
    );
  } else if (validFilter === "payments") {
    merged = merged.filter(
      (i) => i.kind === "transaction" && i.type === "payment",
    );
  } else if (validFilter === "refundRequests") {
    merged = merged.filter((i) => {
      if (i.kind !== "transaction") return false;
      return i.status === "RefundRequested";
    });
  } else if (validFilter === "disputes") {
    merged = merged.filter((i) => {
      if (i.kind !== "transaction") return false;
      return i.status.toLowerCase().includes("dispute");
    });
  }
  merged.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return { merged, transactionLastUpdate };
}

/**
 * One module-level cached function (do not wrap `unstable_cache` per request — that
 * creates a new cache wrapper each time and breaks dedupe). Args are primitives so the
 * Data Cache key is stable; `cacheSegment` is `lastUpdate ?? "__full__"`.
 */
const fetchActivityMergedFeedCached = unstable_cache(
  async (
    userId: string,
    network: NetworkQuery,
    validFilter: ActivityFeedFilter,
    cacheSegment: string,
  ): Promise<ActivityMergedFeedResult> => {
    const lastUpdate = cacheSegment === "__full__" ? undefined : cacheSegment;
    return buildActivityMergedFeedUncached({
      userId,
      network,
      validFilter,
      lastUpdate,
    });
  },
  ["api-activity-merged-feed", "v1"],
  { revalidate: MERGED_FEED_CACHE_REVALIDATE_SECONDS },
);

/**
 * Cached merged feed for GET /api/activity. Pagination cursors slice the same snapshot
 * within the revalidate window so "load more" does not repeat payment-node fetches.
 */
export async function getActivityMergedFeedCached(
  params: BuildMergedFeedParams,
): Promise<ActivityMergedFeedResult> {
  const needLifecycle =
    params.validFilter === "all" || params.validFilter === "lifecycle";
  if (needLifecycle) {
    await maybeBackfillAgentLifecycleEvents({
      userId: params.userId,
      network: params.network,
    });
  }
  const cacheSegment = params.lastUpdate ?? "__full__";
  return fetchActivityMergedFeedCached(
    params.userId,
    params.network,
    params.validFilter,
    cacheSegment,
  );
}
