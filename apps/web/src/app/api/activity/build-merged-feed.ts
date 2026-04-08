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

/** Short TTL for the Prisma-only activity snapshot (agents + lifecycle rows). */
const MERGED_FEED_CACHE_REVALIDATE_SECONDS = 12;

/**
 * Skip repeated Prisma guard queries after a no-op or successful seed. Per Node process only
 * (serverless-friendly); worst case backfill runs again after this window when a new agent appears.
 */
const BACKFILL_GUARD_COOLDOWN_MS = 60_000;
const backfillGuardSkipUntilMs = new Map<string, number>();

function backfillGuardKey(userId: string, network: NetworkQuery): string {
  return `${userId}:${network}`;
}

function markBackfillGuardCooldown(
  userId: string,
  network: NetworkQuery,
): void {
  const now = Date.now();
  if (backfillGuardSkipUntilMs.size > 256) {
    for (const [k, until] of backfillGuardSkipUntilMs) {
      if (until <= now) backfillGuardSkipUntilMs.delete(k);
    }
  }
  backfillGuardSkipUntilMs.set(
    backfillGuardKey(userId, network),
    now + BACKFILL_GUARD_COOLDOWN_MS,
  );
}

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
  const skipUntil = backfillGuardSkipUntilMs.get(
    backfillGuardKey(userId, network),
  );
  if (skipUntil !== undefined && Date.now() < skipUntil) return;

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
  if (agents.length === 0) {
    markBackfillGuardCooldown(userId, network);
    return;
  }
  const agentIds = agents.map((a) => a.id);
  const agentsWithEvents = await prisma.agentActivityEvent.groupBy({
    by: ["agentId"],
    where: { agentId: { in: agentIds } },
    _count: { _all: true },
  });
  const agentIdsThatHaveEvents = new Set(
    agentsWithEvents
      .map((row) => row.agentId)
      .filter((id): id is string => id != null),
  );
  const agentsToBackfill = agents.filter(
    (a) => !agentIdsThatHaveEvents.has(a.id),
  );
  if (agentsToBackfill.length === 0) {
    markBackfillGuardCooldown(userId, network);
    return;
  }

  const [k1, k2] = userIdToAdvisoryLockKeys(userId);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${k1}::integer, ${k2}::integer)`;
      const backfillIds = agentsToBackfill.map((a) => a.id);
      const recheckRows = await tx.agentActivityEvent.groupBy({
        by: ["agentId"],
        where: { agentId: { in: backfillIds } },
        _count: { _all: true },
      });
      const idsWithEventsNow = new Set(
        recheckRows
          .map((row) => row.agentId)
          .filter((id): id is string => id != null),
      );
      for (const agent of agentsToBackfill) {
        if (idsWithEventsNow.has(agent.id)) continue;
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
    markBackfillGuardCooldown(userId, network);
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

type ActivityFeedAgentRow = {
  id: string;
  name: string;
  agentIdentifier: string | null;
  networkIdentifier: string | null;
  registrationState: string;
  verificationStatus: string | null;
};

type ActivityDbSnapshot = {
  agents: ActivityFeedAgentRow[];
  lifecycleItems: ActivityFeedItem[];
};

/** For optional timestamps (e.g. max last-changed); empty when missing or unparseable. */
function optionalPaymentTimestamp(value: string | Date | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const t = Date.parse(trimmed);
    return Number.isFinite(t) ? new Date(t).toISOString() : "";
  }
  const ms = value.getTime();
  return Number.isFinite(ms) ? value.toISOString() : "";
}

/**
 * Always returns a parseable ISO string for `ActivityFeedItem.date` (sort, cursors, relative time).
 * Falls back to epoch when the API omits or sends invalid dates.
 */
function activityTransactionFeedItemDate(p: {
  createdAt?: string | Date;
  updatedAt?: string | Date;
}): string {
  for (const value of [p.createdAt, p.updatedAt]) {
    const iso = optionalPaymentTimestamp(value);
    if (iso.length > 0) return iso;
  }
  return new Date(0).toISOString();
}

function activityFeedDateSortMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Prisma-only: agents + lifecycle rows shaped as feed items (ISO date strings). */
async function loadActivityDbSnapshot(params: {
  userId: string;
  network: NetworkQuery;
  validFilter: ActivityFeedFilter;
}): Promise<ActivityDbSnapshot> {
  const { userId, network, validFilter } = params;
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

  return { agents, lifecycleItems };
}

/** Payment-node list + map to feed items. Runs outside `unstable_cache` (lazy key provisioning, external API). */
async function loadActivityTransactionFeedPart(params: {
  userId: string;
  network: NetworkQuery;
  validFilter: ActivityFeedFilter;
  lastUpdate: string | undefined;
  agents: ActivityFeedAgentRow[];
  agentByIdentifier: Map<string, ActivityFeedAgentRow>;
}): Promise<
  Pick<ActivityMergedFeedResult, "transactionLastUpdate"> & {
    transactionItems: ActivityFeedItem[];
  }
> {
  const {
    userId,
    network,
    validFilter,
    lastUpdate,
    agents,
    agentByIdentifier,
  } = params;

  if (validFilter === "lifecycle") {
    return { transactionItems: [], transactionLastUpdate: undefined };
  }

  const transactionWatermark =
    lastUpdate !== undefined && lastUpdate.length > 0 ? lastUpdate : null;

  let transactionItems: ActivityFeedItem[] = [];
  let transactionLastUpdate: string | undefined;

  try {
    const client = await getPaymentNodeClientForUser(userId);
    if (!client) {
      return { transactionItems, transactionLastUpdate };
    }
    const smartContractAddress =
      await getSmartContractAddressForConfiguredSource(client, userId);
    const agentIdentifiers = new Set(
      agents.map((a) => a.agentIdentifier).filter(Boolean) as string[],
    );
    if (!smartContractAddress || agentIdentifiers.size === 0) {
      return { transactionItems, transactionLastUpdate };
    }

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
    const allPaymentsRaw = paymentsRes.Payments ?? [];
    const allPurchasesRaw = purchasesRes.Purchases ?? [];
    const payments = allPaymentsRaw.filter((p: PaymentOrPurchaseItem) =>
      p.agentIdentifier ? agentIdentifiers.has(p.agentIdentifier) : false,
    );
    const purchases = allPurchasesRaw.filter((p: PaymentOrPurchaseItem) =>
      p.agentIdentifier ? agentIdentifiers.has(p.agentIdentifier) : false,
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
      const fundsForAmount =
        type === "purchase" && p.PaidFunds?.length
          ? p.PaidFunds
          : p.RequestedFunds;
      return {
        kind: "transaction",
        id: p.id,
        date: activityTransactionFeedItemDate(p),
        type,
        agentId: agent?.id ?? null,
        agentName: agent?.name ?? null,
        amount: formatRequestedAmount(fundsForAmount),
        status: String(status),
        txHash: p.CurrentTransaction?.txHash ?? null,
      };
    };
    transactionItems = [
      ...payments.map((p: PaymentOrPurchaseItem) => toItem(p, "payment")),
      ...purchases.map((p: PaymentOrPurchaseItem) => toItem(p, "purchase")),
    ];
    /** Max change time over the full API payload (not agent-filtered) so diff `lastUpdate` advances. */
    const watermarkTimestamps = [...allPaymentsRaw, ...allPurchasesRaw]
      .map((p: PaymentOrPurchaseItem) =>
        optionalPaymentTimestamp(
          p.nextActionOrOnChainStateOrResultLastChangedAt ??
            p.updatedAt ??
            p.createdAt,
        ),
      )
      .filter((s) => s.length > 0);
    transactionLastUpdate =
      watermarkTimestamps.length > 0
        ? watermarkTimestamps.reduce((a, b) => (a > b ? a : b))
        : lastUpdate;
  } catch (txError) {
    console.error("[Activity] Payment node / transactions error:", txError);
  }

  return { transactionItems, transactionLastUpdate };
}

function mergeFilterSortActivityFeed(params: {
  lifecycleItems: ActivityFeedItem[];
  transactionItems: ActivityFeedItem[];
  validFilter: ActivityFeedFilter;
}): ActivityFeedItem[] {
  const { lifecycleItems, transactionItems, validFilter } = params;
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
    (a, b) => activityFeedDateSortMs(b.date) - activityFeedDateSortMs(a.date),
  );
  return merged;
}

/** Input for DB-only cache (no `lastUpdate` — payment-node lists are always fresh). */
type ActivityDbSnapshotCacheInput = {
  userId: string;
  network: NetworkQuery;
  validFilter: ActivityFeedFilter;
};

/**
 * Cache only Prisma reads. Do not put payment-node calls inside `unstable_cache`: lazy API
 * key provisioning and external fetches are side effects and must not run only on revalidate/miss.
 */
async function fetchActivityDbSnapshotCached(
  input: ActivityDbSnapshotCacheInput,
): Promise<ActivityDbSnapshot> {
  const cachedLoader = unstable_cache(
    async (): Promise<ActivityDbSnapshot> => {
      return loadActivityDbSnapshot({
        userId: input.userId,
        network: input.network,
        validFilter: input.validFilter,
      });
    },
    [
      "api-activity-db-snapshot",
      "v1",
      input.userId,
      input.network,
      input.validFilter,
    ],
    { revalidate: MERGED_FEED_CACHE_REVALIDATE_SECONDS },
  );
  return cachedLoader();
}

/**
 * Merged feed for GET /api/activity. DB snapshot is Data-cached briefly; payment-node lists
 * run every request so cursors and `lastUpdate` stay consistent.
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

  const { agents, lifecycleItems } = await fetchActivityDbSnapshotCached({
    userId: params.userId,
    network: params.network,
    validFilter: params.validFilter,
  });

  const agentByIdentifier = new Map(
    agents
      .filter((a) => a.agentIdentifier)
      .map((a) => [a.agentIdentifier!, a] as const),
  );

  const { transactionItems, transactionLastUpdate } =
    await loadActivityTransactionFeedPart({
      userId: params.userId,
      network: params.network,
      validFilter: params.validFilter,
      lastUpdate: params.lastUpdate,
      agents,
      agentByIdentifier,
    });

  const merged = mergeFilterSortActivityFeed({
    lifecycleItems,
    transactionItems,
    validFilter: params.validFilter,
  });

  return { merged, transactionLastUpdate };
}
