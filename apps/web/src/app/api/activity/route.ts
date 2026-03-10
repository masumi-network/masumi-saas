import prisma from "@masumi/database/client";
import { NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import type { PaymentOrPurchaseItem } from "@/lib/payment-node/client";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { getSmartContractAddressForConfiguredSource } from "@/lib/payment-node/resolve-smart-contract";
import type { ActivityFeedItem } from "@/lib/types/activity";

export type { ActivityFeedItem };

const FEED_LIMIT = 80;

type Network = "Mainnet" | "Preprod";
type FeedFilter =
  | "all"
  | "lifecycle"
  | "transactions"
  | "purchases"
  | "payments"
  | "refundRequests"
  | "disputes";

function toNetwork(n: string | null): Network {
  return n === "Mainnet" || n === "Preprod" ? n : "Preprod";
}

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

function formatAmount(
  requestedFunds?: Array<{ unit: string; amount: string }>,
): string {
  if (!requestedFunds?.length) return "—";
  const first = requestedFunds[0]!;
  if (first.unit === "") {
    const lovelace = BigInt(first.amount);
    const ada = Number(lovelace) / 1_000_000;
    return ada.toFixed(6) + " ADA";
  }
  return `${first.amount} ${first.unit.slice(0, 8)}`;
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

      // One-time backfill: if user has agents but no events, create one event per agent from current state
      if (events.length === 0 && agents.length > 0) {
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
                amount: formatAmount(p.RequestedFunds),
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

    return NextResponse.json({
      success: true,
      data: { items: merged.slice(0, FEED_LIMIT) },
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
