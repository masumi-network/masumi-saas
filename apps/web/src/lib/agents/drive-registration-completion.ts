import { completeOnChainRegistration } from "@/lib/agent-registration";
import { doRuntimeDebugLog } from "@/lib/debug/do-runtime-log";
import { serverLog } from "@/lib/server/logger";

const DEFAULT_MAX_ATTEMPTS = 24;
const DEFAULT_DELAY_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type PollAgentRegistrationCompletionResult =
  | { status: "registered" }
  | { status: "pending" }
  | { status: "error"; error: string };

/**
 * Poll payment-node / on-chain completion for an agent that finished the fast
 * registration path (RegistrationRequested). Used by network register and by
 * API routes so clients are not required to keep the dashboard open.
 */
export async function pollAgentRegistrationCompletion(
  agentId: string,
  userId: string,
  options?: { maxAttempts?: number; delayMs?: number },
): Promise<PollAgentRegistrationCompletionResult> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;

  doRuntimeDebugLog("agent-registration", "pollAgentRegistrationCompletion", {
    agentId,
    userId,
    maxAttempts,
  });

  let lastStatus: PollAgentRegistrationCompletionResult["status"] = "pending";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await completeOnChainRegistration(agentId, userId);
    lastStatus = result.status;

    doRuntimeDebugLog(
      "agent-registration",
      "pollAgentRegistrationCompletion attempt",
      {
        agentId,
        attempt,
        status: result.status,
        ...(result.status === "error" ? { error: result.error } : {}),
      },
    );

    if (result.status === "registered") {
      return { status: "registered" };
    }
    if (result.status === "error") {
      return { status: "error", error: result.error };
    }

    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  return lastStatus === "error"
    ? { status: "error", error: "Registration timed out" }
    : { status: "pending" };
}

/** Background completion pollers allowed to run at once in this process. */
export const MAX_BACKGROUND_COMPLETION_POLLERS = 10;

const scheduledAgentIds = new Set<string>();
const pendingCompletions: Array<{ agentId: string; userId: string }> = [];
let activeCompletionPollers = 0;

function drainCompletionQueue(): void {
  while (
    activeCompletionPollers < MAX_BACKGROUND_COMPLETION_POLLERS &&
    pendingCompletions.length > 0
  ) {
    const { agentId, userId } = pendingCompletions.shift()!;
    activeCompletionPollers += 1;
    void pollAgentRegistrationCompletion(agentId, userId)
      .catch((error) => {
        serverLog.error("Background agent registration completion failed", {
          agentId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        activeCompletionPollers -= 1;
        scheduledAgentIds.delete(agentId);
        drainCompletionQueue();
      });
  }
}

/**
 * Fire-and-forget completion polling (does not block the HTTP response).
 * One poller per agent; at most {@link MAX_BACKGROUND_COMPLETION_POLLERS}
 * run at once and the rest wait in a queue.
 */
export function scheduleAgentRegistrationCompletion(
  agentId: string,
  userId: string,
): void {
  if (scheduledAgentIds.has(agentId)) return;
  scheduledAgentIds.add(agentId);
  pendingCompletions.push({ agentId, userId });
  drainCompletionQueue();
}
