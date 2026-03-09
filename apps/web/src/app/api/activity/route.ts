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
type FeedFilter = "all" | "transactions" | "lifecycle";

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
    case "DeregistrationFailed":
      return "DeregistrationConfirmed";
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
    const filter = (searchParams.get("filter") ?? "all") as FeedFilter;
    const validFilter: FeedFilter =
      filter === "transactions" || filter === "lifecycle" ? filter : "all";

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

    const agentById = new Map(agents.map((a) => [a.id, a]));
    const agentByIdentifier = new Map(
      agents
        .filter((a) => a.agentIdentifier)
        .map((a) => [a.agentIdentifier!, a] as const),
    );

    let events = await prisma.agentActivityEvent.findMany({
      where: { agentId: { in: agents.map((a) => a.id) } },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      include: { agent: { select: { id: true, name: true } } },
    });

    // One-time backfill: if user has agents but no events, create one event per agent from current state
    if (events.length === 0 && agents.length > 0) {
      for (const agent of agents) {
        const stateEventType = registrationStateToEventType(
          agent.registrationState,
        );
        if (stateEventType) {
          try {
            await prisma.agentActivityEvent.create({
              data: { agentId: agent.id, type: stateEventType },
            });
          } catch (err) {
            console.error("[Activity] Backfill create failed:", agent.id, err);
          }
        }
        if (agent.verificationStatus === "VERIFIED") {
          try {
            await prisma.agentActivityEvent.create({
              data: { agentId: agent.id, type: "AgentVerified" },
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
      events = await prisma.agentActivityEvent.findMany({
        where: { agentId: { in: agents.map((a) => a.id) } },
        orderBy: { createdAt: "desc" },
        take: FEED_LIMIT,
        include: { agent: { select: { id: true, name: true } } },
      });
    }

    const lifecycleItems: ActivityFeedItem[] = events.map((e) => ({
      kind: "lifecycle",
      id: e.id,
      date: e.createdAt.toISOString(),
      type: e.type,
      agentId: e.agent.id,
      agentName: e.agent.name,
    }));

    let transactionItems: ActivityFeedItem[] = [];
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
            p.agentIdentifier ? agentIdentifiers.has(p.agentIdentifier) : false,
          );
          const purchases = (purchasesRes.Purchases ?? []).filter((p) =>
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

    let merged: ActivityFeedItem[] = [...lifecycleItems, ...transactionItems];
    if (validFilter === "transactions") {
      merged = merged.filter((i) => i.kind === "transaction");
    } else if (validFilter === "lifecycle") {
      merged = merged.filter((i) => i.kind === "lifecycle");
    }
    merged.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

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
