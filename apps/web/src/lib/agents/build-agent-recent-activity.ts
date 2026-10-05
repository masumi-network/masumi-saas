import prisma from "@masumi/database/client";

import { AGENT_RECENT_ACTIVITY_MERGE_LIMIT } from "@/lib/agents/agent-recent-activity.constants";
import type { AgentTransactionRow } from "@/lib/agents/get-agent-transactions-for-user";
import { buildAgentActivityTimeline } from "@/lib/agents/registration-status-timeline";

export {
  AGENT_RECENT_ACTIVITY_MERGE_LIMIT,
  AGENT_RECENT_ACTIVITY_PAGE_SIZE,
} from "@/lib/agents/agent-recent-activity.constants";

export type AgentRecentActivityLifecycleItem = {
  kind: "lifecycle";
  id: string;
  date: string;
  /** i18n key under App.Agents.Details.statusTimeline.steps or activity lifecycle label */
  eventKey: string;
  failed?: boolean;
};

export type AgentRecentActivityTransactionItem = {
  kind: "transaction";
  id: string;
  date: string;
  txType: "payment" | "purchase";
  amount: string;
  status: string;
  txHash: string | null;
};

export type AgentRecentActivityItem =
  | AgentRecentActivityLifecycleItem
  | AgentRecentActivityTransactionItem;

const DB_ONLY_LIFECYCLE_TYPES = new Set(["AgentVerified", "AgentDeleted"]);

const FAILED_REGISTRATION_STATES = new Set([
  "RegistrationFailed",
  "UpdateFailed",
  "DeregistrationFailed",
]);

function toIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function lifecycleFromTimeline(params: {
  registrationState: string;
  createdAt: string;
  updatedAt: string;
  registrationInitiatedAt?: string | null;
}): AgentRecentActivityLifecycleItem[] {
  const { steps } = buildAgentActivityTimeline({
    registrationState: params.registrationState,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    registrationInitiatedAt: params.registrationInitiatedAt,
  });

  const items: AgentRecentActivityLifecycleItem[] = [];
  for (const step of steps) {
    if (step.status === "upcoming") continue;
    const date =
      step.occurredAt ??
      (step.status === "current" || step.status === "failed"
        ? params.updatedAt
        : null);
    if (!date) continue;
    items.push({
      kind: "lifecycle",
      id: `timeline:${step.state}`,
      date,
      eventKey: step.state,
      ...(step.status === "failed" ? { failed: true } : {}),
    });
  }
  return items;
}

function lifecycleFromDbEvents(
  events: { id: string; type: string; createdAt: Date }[],
): AgentRecentActivityLifecycleItem[] {
  return events.map((e) => ({
    kind: "lifecycle",
    id: e.id,
    date: e.createdAt.toISOString(),
    eventKey: e.type,
  }));
}

function mergeLifecycleItems(
  timeline: AgentRecentActivityLifecycleItem[],
  db: AgentRecentActivityLifecycleItem[],
  registrationState: string,
): AgentRecentActivityLifecycleItem[] {
  if (timeline.length === 0) {
    return db;
  }
  const timelineShowsFailure = timeline.some((item) => item.failed);
  const extraDb = db.filter((item) => {
    if (DB_ONLY_LIFECYCLE_TYPES.has(item.eventKey)) {
      return true;
    }
    if (item.eventKey === "RegistrationFailed") {
      return (
        FAILED_REGISTRATION_STATES.has(registrationState) &&
        !timelineShowsFailure
      );
    }
    return false;
  });
  return [...timeline, ...extraDb];
}

function toTransactionItems(
  transactions: AgentTransactionRow[],
): AgentRecentActivityTransactionItem[] {
  return transactions.map((tx) => ({
    kind: "transaction",
    id: tx.id,
    date: tx.createdAt,
    txType: tx.type,
    amount: tx.amount,
    status: tx.status,
    txHash: tx.txHash,
  }));
}

export function sortAgentRecentActivityItems(
  items: AgentRecentActivityItem[],
): AgentRecentActivityItem[] {
  return [...items].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function paginateAgentRecentActivity(
  items: AgentRecentActivityItem[],
  page: number,
  pageSize: number,
): {
  items: AgentRecentActivityItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
} {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalCount,
    totalPages,
  };
}

export async function buildAgentRecentActivityFeed(params: {
  agentId: string;
  registrationState: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  registrationInitiatedAt?: string | Date | null;
  transactions: AgentTransactionRow[];
}): Promise<AgentRecentActivityItem[]> {
  const createdAt = toIso(params.createdAt) ?? new Date().toISOString();
  const updatedAt = toIso(params.updatedAt) ?? createdAt;
  const registrationInitiatedAt = toIso(params.registrationInitiatedAt);

  const timeline = lifecycleFromTimeline({
    registrationState: params.registrationState,
    createdAt,
    updatedAt,
    registrationInitiatedAt,
  });

  const dbEvents = await prisma.agentActivityEvent.findMany({
    where: { agentId: params.agentId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, type: true, createdAt: true },
  });

  const lifecycle = mergeLifecycleItems(
    timeline,
    lifecycleFromDbEvents(dbEvents),
    params.registrationState,
  );
  const merged = sortAgentRecentActivityItems([
    ...lifecycle,
    ...toTransactionItems(params.transactions),
  ]);

  return merged.slice(0, AGENT_RECENT_ACTIVITY_MERGE_LIMIT);
}
