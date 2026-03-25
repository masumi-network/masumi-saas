import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import {
  decodeActivityCursor,
  encodeActivityCursor,
} from "@/lib/activity-cursor";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { formatRequestedAmount } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import {
  activityQueryInputSchema,
  parseActivityQueryInput,
} from "@/lib/schemas/activity";
import type { ActivityFeedItem } from "@/lib/types/activity";

export type { ActivityFeedFilter as FeedFilter } from "@/lib/schemas/activity";
export type { ActivityFeedItem };

/** Max items merged for the feed (lifecycle + payments/purchases) before response. */
const FEED_LIMIT = 200;

/** Serialize lifecycle backfill per user so concurrent requests don't create duplicate events. */
const backfillLocks = new Map<string, Promise<void>>();

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

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const { searchParams } = request.nextUrl;
    const queryRaw = activityQueryInputSchema.parse({
      filter: searchParams.get("filter") ?? undefined,
      network: searchParams.get("network"),
      summary: searchParams.get("summary") ?? undefined,
      lastUpdate: searchParams.get("lastUpdate") ?? undefined,
    });
    const query = parseActivityQueryInput(queryRaw);
    const validFilter = query.filter;
    const network = query.network;

    /** Match GET /api/agents — strict network so Preprod/Mainnet feeds do not share null-network agents. */
    const agents = await prisma.agent.findMany({
      where: { userId: user.id, networkIdentifier: network },
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
        // Orphan events (agent deleted); scoped by networkIdentifier — omit rows with null (pre-migration).
        prisma.agentActivityEvent.findMany({
          where: { userId: user.id, agentId: null, networkIdentifier: network },
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
                    agentNameSnapshot: agent.name,
                    networkIdentifier: agent.networkIdentifier,
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
                    agentNameSnapshot: agent.name,
                    networkIdentifier: agent.networkIdentifier,
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
            where: {
              userId: user.id,
              agentId: null,
              networkIdentifier: network,
            },
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
        agentName: e.agent?.name ?? e.agentNameSnapshot ?? null,
      }));
    }

    const useDiff = Boolean(query.lastUpdate);
    const needTransactions = validFilter !== "lifecycle";

    let transactionItems: ActivityFeedItem[] = [];
    let transactionLastUpdate: string | undefined;
    if (needTransactions) {
      try {
        const client = await getPaymentNodeClientForUser(user.id);
        if (client) {
          const smartContractAddress =
            await getSmartContractAddressForConfiguredSource(client, user.id);
          const agentIdentifiers = new Set(
            agents.map((a) => a.agentIdentifier).filter(Boolean) as string[],
          );
          if (smartContractAddress && agentIdentifiers.size > 0) {
            const listLimit = 100;
            const diffLimit = 100;
            const [paymentsRes, purchasesRes] = useDiff
              ? await Promise.all([
                  client.listPaymentDiff({
                    network,
                    filterSmartContractAddress: smartContractAddress,
                    lastUpdate: query.lastUpdate!,
                    limit: diffLimit,
                  }),
                  client.listPurchaseDiff({
                    network,
                    filterSmartContractAddress: smartContractAddress,
                    lastUpdate: query.lastUpdate!,
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
              ...payments.map((p: PaymentOrPurchaseItem) =>
                toItem(p, "payment"),
              ),
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
                : query.lastUpdate;
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

    const summary = query.summary === true;
    if (summary) {
      const totalTransactions = merged.filter(
        (i) => i.kind === "transaction",
      ).length;
      const data: {
        totalTransactions: number;
        totalActivity: number;
        lastUpdate?: string;
      } = {
        totalTransactions,
        totalActivity: merged.length,
      };
      if (transactionLastUpdate) data.lastUpdate = transactionLastUpdate;
      return NextResponse.json({
        success: true,
        data,
      });
    }

    const limitRaw = searchParams.get("limit");
    const usePagination = limitRaw != null && limitRaw !== "";

    if (!usePagination) {
      const items = merged.slice(0, FEED_LIMIT);
      const data: { items: ActivityFeedItem[]; lastUpdate?: string } = {
        items,
      };
      if (validFilter === "transactions" && transactionLastUpdate)
        data.lastUpdate = transactionLastUpdate;
      return NextResponse.json({
        success: true,
        data,
      });
    }

    const pageLimit = Math.min(50, Math.max(1, parseInt(limitRaw, 10) || 20));
    const cursorParam = searchParams.get("cursor");
    let start = 0;
    if (cursorParam) {
      const c = decodeActivityCursor(cursorParam);
      if (c) {
        const idx = merged.findIndex(
          (it) => it.date === c.d && it.kind === c.k && it.id === c.i,
        );
        start = idx >= 0 ? idx + 1 : 0;
      }
    }

    const pageItems = merged.slice(start, start + pageLimit);
    const nextCursor =
      pageItems.length === pageLimit && start + pageLimit < merged.length
        ? encodeActivityCursor(pageItems[pageItems.length - 1]!)
        : null;

    const data: {
      items: ActivityFeedItem[];
      nextCursor: string | null;
      lastUpdate?: string;
    } = {
      items: pageItems,
      nextCursor,
    };
    if (validFilter === "transactions" && transactionLastUpdate)
      data.lastUpdate = transactionLastUpdate;
    return NextResponse.json({
      success: true,
      data,
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
