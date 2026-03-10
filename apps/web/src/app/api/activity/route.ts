import prisma from "@masumi/database/client";
import { NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { formatRequestedAmount, toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import type { ActivityFeedItem } from "@/lib/types/activity";

export type { ActivityFeedItem };

const FEED_LIMIT = 80;
/** Cache TTL for transaction-only responses (badge count). Reduces payment node load when multiple tabs or frequent polls. */
const TRANSACTIONS_CACHE_TTL_MS = 25_000;
/** Max number of user entries; oldest (by cachedAt) evicted when full to prevent unbounded growth. */
const TRANSACTIONS_CACHE_MAX_USERS = 500;

const transactionsCache = new Map<
  string,
  { items: ActivityFeedItem[]; cachedAt: number }
>();

function getCachedTransactions(userId: string): ActivityFeedItem[] | null {
  const entry = transactionsCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TRANSACTIONS_CACHE_TTL_MS) {
    transactionsCache.delete(userId);
    return null;
  }
  return entry.items;
}

function setCachedTransactions(
  userId: string,
  items: ActivityFeedItem[],
): void {
  const now = Date.now();
  // Evict expired entries so users who never return don't leak memory
  for (const [uid, e] of transactionsCache) {
    if (now - e.cachedAt > TRANSACTIONS_CACHE_TTL_MS) {
      transactionsCache.delete(uid);
    }
  }
  // If at capacity, evict oldest entry
  if (transactionsCache.size >= TRANSACTIONS_CACHE_MAX_USERS) {
    let oldestKey: string | null = null;
    let oldestAt = now;
    for (const [uid, e] of transactionsCache) {
      if (e.cachedAt < oldestAt) {
        oldestAt = e.cachedAt;
        oldestKey = uid;
      }
    }
    if (oldestKey) transactionsCache.delete(oldestKey);
  }
  transactionsCache.set(userId, { items, cachedAt: now });
}

/** Serialize lifecycle backfill per user so concurrent requests don't create duplicate events. */
const backfillLocks = new Map<string, Promise<void>>();

type FeedFilter =
  | "all"
  | "lifecycle"
  | "transactions"
  | "purchases"
  | "payments"
  | "refundRequests"
  | "disputes";

/** Map current registration state to a single lifecycle event for backfill. */
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

export async function GET(request: Request) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);
    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get("filter") ?? "all") as string;
    const validFilter: FeedFilter = [
      "lifecycle",
      "transactions",
      "purchases",
      "payments",
      "refundRequests",
      "disputes",
    ].includes(filter)
      ? (filter as FeedFilter)
      : "all";

    if (validFilter === "transactions") {
      const cached = getCachedTransactions(user.id);
      if (cached) {
        const summary = searchParams.get("summary") === "1";
        if (summary) {
          const totalTransactions = cached.filter(
            (i) => i.kind === "transaction",
          ).length;
          return NextResponse.json({
            success: true,
            data: {
              totalTransactions,
              totalActivity: cached.length,
            },
          });
        }
        return NextResponse.json({
          success: true,
          data: { items: cached },
        });
      }
    }

    const agents = await prisma.agent.findMany({
      where: { userId: user.id },
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
          take: FEED_LIMIT,
          include: { agent: { select: { id: true, name: true } } },
        }),
        // Orphan events (e.g. AgentDeleted after agent row removed); agentId is null
        prisma.agentActivityEvent.findMany({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma nullable filter type mismatch before client regen
          where: { userId: user.id, agentId: null } as any,
          orderBy: { createdAt: "desc" },
          take: FEED_LIMIT,
          include: { agent: { select: { id: true, name: true } } },
        }),
      ]);
      let events = [...eventsForAgents, ...orphanEvents]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, FEED_LIMIT);

      // One-time backfill: if user has agents but no events, create one event per agent from current state.
      // Use a per-user lock so concurrent requests don't both create duplicates.
      if (events.length === 0 && agents.length > 0) {
        const lockKey = user.id;
        const runBackfill = async () => {
          const recheck = await prisma.agentActivityEvent.findMany({
            where: { agentId: { in: agentIds } },
            take: 1,
          });
          if (recheck.length > 0) return;
          for (const agent of agents) {
            const stateEventType = registrationStateToEventType(
              agent.registrationState,
            );
            if (stateEventType) {
              try {
                await prisma.agentActivityEvent.create({
                  data: {
                    agentId: agent.id,
                    userId: user.id,
                    type: stateEventType,
                  },
                });
              } catch (err) {
                console.error(
                  "[Activity] Backfill create failed:",
                  agent.id,
                  err,
                );
              }
            }
            if (agent.verificationStatus === "VERIFIED") {
              try {
                await prisma.agentActivityEvent.create({
                  data: {
                    agentId: agent.id,
                    userId: user.id,
                    type: "AgentVerified",
                  },
                });
              } catch (err) {
                console.error(
                  "[Activity] Backfill verified failed:",
                  agent.id,
                  err,
                );
              }
            }
          }
        };
        let lockPromise = backfillLocks.get(lockKey);
        if (!lockPromise) {
          lockPromise = runBackfill().finally(() => {
            backfillLocks.delete(lockKey);
          });
          backfillLocks.set(lockKey, lockPromise);
        }
        await lockPromise;
        const [refetchForAgents, refetchOrphans] = await Promise.all([
          prisma.agentActivityEvent.findMany({
            where: { agentId: { in: agentIds } },
            orderBy: { createdAt: "desc" },
            take: FEED_LIMIT,
            include: { agent: { select: { id: true, name: true } } },
          }),
          prisma.agentActivityEvent.findMany({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nullable agentId filter
            where: { userId: user.id, agentId: null } as any,
            orderBy: { createdAt: "desc" },
            take: FEED_LIMIT,
            include: { agent: { select: { id: true, name: true } } },
          }),
        ]);
        events = [...refetchForAgents, ...refetchOrphans]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, FEED_LIMIT);
      }

      lifecycleItems = events.map((e) => ({
        kind: "lifecycle",
        id: e.id,
        date: e.createdAt.toISOString(),
        type: e.type,
        agentId: e.agent?.id ?? null,
        agentName: e.agent?.name ?? null,
      }));
    }

    const needTransactions = validFilter !== "lifecycle";

    let transactionItems: ActivityFeedItem[] = [];
    if (needTransactions) {
      try {
        const client = await getPaymentNodeClientForUser(user.id);
        if (client) {
          const smartContractAddress =
            await getSmartContractAddressForConfiguredSource(client);
          const agentIdentifiers = new Set(
            agents.map((a) => a.agentIdentifier).filter(Boolean) as string[],
          );
          if (smartContractAddress && agentIdentifiers.size > 0) {
            // Activity feed is scoped to one network (first agent's); we do not aggregate across networks.
            const network = toNetwork(agents[0]?.networkIdentifier ?? null);
            const [paymentsRes, purchasesRes] = await Promise.all([
              client.listPayments({
                network,
                filterSmartContractAddress: smartContractAddress,
                limit: 50,
              }),
              client.listPurchases({
                network,
                filterSmartContractAddress: smartContractAddress,
                limit: 50,
              }),
            ]);
            const payments = (paymentsRes.Payments ?? []).filter((p) =>
              p.agentIdentifier
                ? agentIdentifiers.has(p.agentIdentifier)
                : false,
            );
            const purchases = (purchasesRes.Purchases ?? []).filter((p) =>
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
              ...payments.map((p) => toItem(p, "payment")),
              ...purchases.map((p) => toItem(p, "purchase")),
            ];
          }
        }
      } catch (txError) {
        console.error("[Activity] Payment node / transactions error:", txError);
        // Continue with lifecycle-only; don't fail the whole request
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
      merged = merged.filter(
        (i) => i.kind === "transaction" && i.status === "RefundRequested",
      );
    } else if (validFilter === "disputes") {
      merged = merged.filter(
        (i) =>
          i.kind === "transaction" &&
          i.status.toLowerCase().includes("dispute"),
      );
    }
    merged.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const summary = searchParams.get("summary") === "1";
    if (summary) {
      const totalTransactions = merged.filter(
        (i) => i.kind === "transaction",
      ).length;
      return NextResponse.json({
        success: true,
        data: {
          totalTransactions,
          totalActivity: merged.length,
        },
      });
    }

    const items = merged.slice(0, FEED_LIMIT);
    if (validFilter === "transactions") {
      setCachedTransactions(user.id, items);
    }
    return NextResponse.json({
      success: true,
      data: { items },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get activity feed:", error);
    const message =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "Failed to load activity";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
