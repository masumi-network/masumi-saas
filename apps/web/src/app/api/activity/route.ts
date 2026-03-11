import prisma from "@masumi/database/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { formatRequestedAmount, toNetwork } from "@/lib/payment-node/format";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import type { ActivityFeedItem } from "@/lib/types/activity";

export type { ActivityFeedItem };

const FEED_LIMIT = 80;

const feedFilterSchema = z.enum([
  "all",
  "lifecycle",
  "transactions",
  "purchases",
  "payments",
  "refundRequests",
  "disputes",
]);
export type FeedFilter = z.infer<typeof feedFilterSchema>;

const activityQuerySchema = z.object({
  filter: feedFilterSchema.catch("all"),
  summary: z
    .string()
    .optional()
    .transform((v) => v === "1"),
  lastUpdate: z
    .string()
    .optional()
    .transform((v) => {
      if (!v?.trim()) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }),
});

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

export async function GET(request: Request) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);
    const { searchParams } = new URL(request.url);
    const query = activityQuerySchema.parse({
      filter: searchParams.get("filter") ?? "all",
      summary: searchParams.get("summary") ?? undefined,
      lastUpdate: searchParams.get("lastUpdate") ?? undefined,
    });
    const validFilter = query.filter;

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
            const network = toNetwork(agents[0]?.networkIdentifier ?? null);
            const listLimit = 50;
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
            const lastChangedFields = [...payments, ...purchases].map(
              (p) =>
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
