"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import z from "zod";

import {
  completeRegistrationIfReadyAction,
  getPendingOnChainVerificationAgentIdsAction,
  getPendingRegistrationAgentIdsAction,
} from "@/lib/actions/agent.action";
import { agentApiClient } from "@/lib/api/agent.client";
import { useSession } from "@/lib/auth/auth.client";
import { useNotifications } from "@/lib/context/notifications-context";

export const EVENT_AGENT_REGISTRATION_COMPLETE = "agent-registration-complete";

const REGISTRATION_POLL_INTERVAL_MS = 5_000;
const ON_CHAIN_POLL_INTERVAL_MS = 12_000;
const FIRST_TICK_DELAY_MS = 2_000;
const MAX_POLL_ATTEMPTS = 120;

const PENDING_REGISTRATION_KEY_PREFIX = "masumi-pending-registration-ids";
const REGISTRATION_RETRIES_KEY_PREFIX = "masumi-pending-registration-retries";
const PENDING_ON_CHAIN_KEY_PREFIX = "masumi-pending-on-chain-verification-ids";
const ON_CHAIN_NOTIFIED_KEY_PREFIX =
  "masumi-on-chain-verification-notified-ids";

const idListSchema = z.array(z.string());

function registrationStorageKey(userId: string | null): string | null {
  return userId ? `${PENDING_REGISTRATION_KEY_PREFIX}-${userId}` : null;
}

function registrationRetriesKey(userId: string | null): string | null {
  return userId ? `${REGISTRATION_RETRIES_KEY_PREFIX}-${userId}` : null;
}

function onChainPendingKey(userId: string | null): string | null {
  return userId ? `${PENDING_ON_CHAIN_KEY_PREFIX}-${userId}` : null;
}

function onChainNotifiedKey(userId: string | null): string | null {
  return userId ? `${ON_CHAIN_NOTIFIED_KEY_PREFIX}-${userId}` : null;
}

function loadIdSet(storageKey: string | null): Set<string> {
  if (typeof window === "undefined" || !storageKey) return new Set();
  try {
    const raw = sessionStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    const result = idListSchema.safeParse(parsed);
    return result.success ? new Set(result.data) : new Set();
  } catch {
    return new Set();
  }
}

function saveIdSet(ids: Set<string>, storageKey: string | null): void {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    const arr = Array.from(ids);
    if (arr.length === 0) {
      sessionStorage.removeItem(storageKey);
    } else {
      sessionStorage.setItem(storageKey, JSON.stringify(arr));
    }
  } catch {
    // ignore
  }
}

function loadRetryCounts(retryKey: string | null): Map<string, number> {
  if (typeof window === "undefined" || !retryKey) return new Map();
  try {
    const raw = sessionStorage.getItem(retryKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.entries(parsed).every(
        ([k, v]) => typeof k === "string" && typeof v === "number",
      )
    ) {
      return new Map(Object.entries(parsed) as [string, number][]);
    }
  } catch {
    // ignore
  }
  return new Map();
}

function saveRetryCounts(
  counts: Map<string, number>,
  retryKey: string | null,
): void {
  if (typeof window === "undefined" || !retryKey) return;
  try {
    if (counts.size === 0) {
      sessionStorage.removeItem(retryKey);
    } else {
      sessionStorage.setItem(
        retryKey,
        JSON.stringify(Object.fromEntries(counts)),
      );
    }
  } catch {
    // ignore
  }
}

export type AgentCompletionContextValue = {
  addPendingRegistration: (agentId: string) => void;
  addPendingOnChainVerification: (agentId: string) => void;
};

const AgentCompletionContext =
  createContext<AgentCompletionContextValue | null>(null);

export function useAgentCompletion(): AgentCompletionContextValue {
  const ctx = useContext(AgentCompletionContext);
  if (!ctx) {
    throw new Error(
      "useAgentCompletion must be used within AgentCompletionProvider",
    );
  }
  return ctx;
}

export function AgentCompletionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("App.Notifications");
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const registrationStorageKeyRef = useRef(registrationStorageKey(userId));
  const registrationRetriesKeyRef = useRef(registrationRetriesKey(userId));
  const onChainPendingKeyRef = useRef(onChainPendingKey(userId));
  const onChainNotifiedKeyRef = useRef(onChainNotifiedKey(userId));
  registrationStorageKeyRef.current = registrationStorageKey(userId);
  registrationRetriesKeyRef.current = registrationRetriesKey(userId);
  onChainPendingKeyRef.current = onChainPendingKey(userId);
  onChainNotifiedKeyRef.current = onChainNotifiedKey(userId);

  const registrationPendingRef = useRef<Set<string>>(new Set());
  const registrationRetryRef = useRef<Map<string, number>>(new Map());
  const registrationPollingRef = useRef(false);
  const registrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const registrationFirstTickRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const registrationTickRef = useRef<(() => void) | null>(null);

  const onChainPendingRef = useRef<Set<string>>(new Set());
  const onChainNotifiedRef = useRef<Set<string>>(new Set());
  const onChainRetryRef = useRef<Map<string, number>>(new Map());
  const onChainPollingRef = useRef(false);
  const onChainIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const onChainFirstTickRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const onChainTickRef = useRef<(() => void) | null>(null);

  const tRef = useRef(t);
  tRef.current = t;
  const { addNotification } = useNotifications();
  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  const clearRegistrationPolling = useCallback(() => {
    if (registrationFirstTickRef.current !== null) {
      clearTimeout(registrationFirstTickRef.current);
      registrationFirstTickRef.current = null;
    }
    if (registrationIntervalRef.current !== null) {
      clearInterval(registrationIntervalRef.current);
      registrationIntervalRef.current = null;
    }
  }, []);

  const clearOnChainPolling = useCallback(() => {
    if (onChainFirstTickRef.current !== null) {
      clearTimeout(onChainFirstTickRef.current);
      onChainFirstTickRef.current = null;
    }
    if (onChainIntervalRef.current !== null) {
      clearInterval(onChainIntervalRef.current);
      onChainIntervalRef.current = null;
    }
  }, []);

  const startRegistrationPolling = useCallback(() => {
    clearRegistrationPolling();
    registrationIntervalRef.current = setInterval(() => {
      registrationTickRef.current?.();
    }, REGISTRATION_POLL_INTERVAL_MS);
    registrationFirstTickRef.current = setTimeout(() => {
      registrationFirstTickRef.current = null;
      registrationTickRef.current?.();
    }, FIRST_TICK_DELAY_MS);
  }, [clearRegistrationPolling]);

  const startOnChainPolling = useCallback(() => {
    clearOnChainPolling();
    onChainIntervalRef.current = setInterval(() => {
      onChainTickRef.current?.();
    }, ON_CHAIN_POLL_INTERVAL_MS);
    onChainFirstTickRef.current = setTimeout(() => {
      onChainFirstTickRef.current = null;
      onChainTickRef.current?.();
    }, FIRST_TICK_DELAY_MS);
  }, [clearOnChainPolling]);

  const addPendingRegistration = useCallback(
    (agentId: string) => {
      const next = new Set(registrationPendingRef.current);
      next.add(agentId);
      registrationPendingRef.current = next;
      saveIdSet(next, registrationStorageKeyRef.current);
      startRegistrationPolling();
    },
    [startRegistrationPolling],
  );

  const addPendingOnChainVerification = useCallback(
    (agentId: string) => {
      if (onChainNotifiedRef.current.has(agentId)) return;
      const next = new Set(onChainPendingRef.current);
      next.add(agentId);
      onChainPendingRef.current = next;
      saveIdSet(next, onChainPendingKeyRef.current);
      startOnChainPolling();
    },
    [startOnChainPolling],
  );

  useEffect(() => {
    const tick = async () => {
      if (registrationPendingRef.current.size === 0) {
        clearRegistrationPolling();
        return;
      }
      if (registrationPollingRef.current) return;

      registrationPollingRef.current = true;
      try {
        const ids = Array.from(registrationPendingRef.current);
        const toPoll: string[] = [];

        for (const agentId of ids) {
          const attempts = (registrationRetryRef.current.get(agentId) ?? 0) + 1;
          registrationRetryRef.current.set(agentId, attempts);
          if (attempts > MAX_POLL_ATTEMPTS) {
            const next = new Set(registrationPendingRef.current);
            next.delete(agentId);
            registrationPendingRef.current = next;
            registrationRetryRef.current.delete(agentId);
            saveIdSet(next, registrationStorageKeyRef.current);
            saveRetryCounts(
              registrationRetryRef.current,
              registrationRetriesKeyRef.current,
            );
            toast.error(tRef.current("registrationTimedOut"));
            addNotificationRef.current({
              type: "error",
              titleKey: "registrationTimedOut",
              link: {
                href: `/ai-agents/${agentId}`,
                labelKey: "viewAgent",
              },
            });
          } else {
            toPoll.push(agentId);
          }
        }

        saveRetryCounts(
          registrationRetryRef.current,
          registrationRetriesKeyRef.current,
        );

        const results = await Promise.allSettled(
          toPoll.map((agentId) => completeRegistrationIfReadyAction(agentId)),
        );

        const toRemove: {
          agentId: string;
          kind: "registered" | "error";
          errorMessage?: string;
        }[] = [];

        for (let i = 0; i < toPoll.length; i++) {
          const agentId = toPoll[i];
          const settled = results[i];
          if (settled.status !== "fulfilled") continue;
          const result = settled.value;
          if (result.status === "registered") {
            toRemove.push({ agentId, kind: "registered" });
          } else if (result.status === "error") {
            toRemove.push({
              agentId,
              kind: "error",
              errorMessage: result.error,
            });
          }
        }

        if (toRemove.length === 0) return;

        const next = new Set(registrationPendingRef.current);
        for (const { agentId } of toRemove) {
          next.delete(agentId);
          registrationRetryRef.current.delete(agentId);
        }
        registrationPendingRef.current = next;
        saveIdSet(next, registrationStorageKeyRef.current);
        saveRetryCounts(
          registrationRetryRef.current,
          registrationRetriesKeyRef.current,
        );

        for (const { agentId, kind, errorMessage } of toRemove) {
          if (kind === "registered") {
            toast.success(tRef.current("agentRegistrationComplete"));
            addNotificationRef.current({
              type: "success",
              titleKey: "agentRegistrationComplete",
              link: {
                href: `/ai-agents/${agentId}`,
                labelKey: "viewAgent",
              },
            });
            window.dispatchEvent(
              new CustomEvent(EVENT_AGENT_REGISTRATION_COMPLETE, {
                detail: { agentId },
              }),
            );
          } else {
            const msg = errorMessage ?? tRef.current("registrationFailed");
            toast.error(msg);
            addNotificationRef.current({
              type: "error",
              titleKey: "registrationFailed",
              link: {
                href: `/ai-agents/${agentId}`,
                labelKey: "viewAgent",
              },
            });
          }
        }
      } finally {
        registrationPollingRef.current = false;
      }
    };

    registrationTickRef.current = () => void tick();
    return clearRegistrationPolling;
  }, [clearRegistrationPolling]);

  useEffect(() => {
    const notifyComplete = (agentId: string) => {
      if (onChainNotifiedRef.current.has(agentId)) return;
      onChainNotifiedRef.current.add(agentId);
      saveIdSet(onChainNotifiedRef.current, onChainNotifiedKeyRef.current);

      const nextPending = new Set(onChainPendingRef.current);
      nextPending.delete(agentId);
      onChainPendingRef.current = nextPending;
      saveIdSet(nextPending, onChainPendingKeyRef.current);
      onChainRetryRef.current.delete(agentId);

      toast.success(tRef.current("agentOnChainVerificationComplete"));
      addNotificationRef.current({
        type: "success",
        titleKey: "agentOnChainVerificationComplete",
        link: {
          href: `/ai-agents/${agentId}?tab=verification`,
          labelKey: "viewAgent",
        },
      });
    };

    const tick = async () => {
      if (onChainPendingRef.current.size === 0) {
        clearOnChainPolling();
        return;
      }
      if (onChainPollingRef.current) return;

      onChainPollingRef.current = true;
      try {
        const ids = Array.from(onChainPendingRef.current);
        const toPoll: string[] = [];

        for (const agentId of ids) {
          if (onChainNotifiedRef.current.has(agentId)) {
            const next = new Set(onChainPendingRef.current);
            next.delete(agentId);
            onChainPendingRef.current = next;
            saveIdSet(next, onChainPendingKeyRef.current);
            continue;
          }

          const attempts = (onChainRetryRef.current.get(agentId) ?? 0) + 1;
          onChainRetryRef.current.set(agentId, attempts);
          if (attempts > MAX_POLL_ATTEMPTS) {
            const next = new Set(onChainPendingRef.current);
            next.delete(agentId);
            onChainPendingRef.current = next;
            saveIdSet(next, onChainPendingKeyRef.current);
            onChainRetryRef.current.delete(agentId);
          } else {
            toPoll.push(agentId);
          }
        }

        const results = await Promise.allSettled(
          toPoll.map((agentId) =>
            agentApiClient.getOnChainVerificationStatus(agentId),
          ),
        );

        for (let i = 0; i < toPoll.length; i++) {
          const agentId = toPoll[i];
          const settled = results[i];
          if (settled.status !== "fulfilled" || !settled.value.success) {
            continue;
          }
          const status = settled.value.data;
          if (status.verified && status.resolutionSource === "on-chain") {
            notifyComplete(agentId);
          }
        }
      } finally {
        onChainPollingRef.current = false;
      }
    };

    onChainTickRef.current = () => void tick();
    return clearOnChainPolling;
  }, [clearOnChainPolling]);

  useEffect(() => {
    const regKey = registrationStorageKey(userId);
    const onChainKey = onChainPendingKey(userId);
    const notifiedKey = onChainNotifiedKey(userId);

    if (!regKey || !onChainKey || !notifiedKey) {
      registrationPendingRef.current = new Set();
      registrationRetryRef.current = new Map();
      onChainPendingRef.current = new Set();
      onChainNotifiedRef.current = new Set();
      onChainRetryRef.current = new Map();
      return () => {
        clearRegistrationPolling();
        clearOnChainPolling();
      };
    }

    registrationPendingRef.current = loadIdSet(regKey);
    onChainPendingRef.current = loadIdSet(onChainKey);
    onChainNotifiedRef.current = loadIdSet(notifiedKey);

    const storedRetries = loadRetryCounts(registrationRetriesKey(userId));
    for (const [id, count] of storedRetries) {
      registrationRetryRef.current.set(id, count);
    }

    if (registrationPendingRef.current.size > 0) {
      startRegistrationPolling();
    }
    if (onChainPendingRef.current.size > 0) {
      startOnChainPolling();
    }

    let cancelled = false;
    void Promise.all([
      getPendingRegistrationAgentIdsAction(),
      getPendingOnChainVerificationAgentIdsAction(),
    ])
      .then(([registrationIds, onChainIds]) => {
        if (cancelled) return;

        if (registrationIds.length > 0) {
          const merged = new Set([
            ...registrationPendingRef.current,
            ...registrationIds,
          ]);
          registrationPendingRef.current = merged;
          saveIdSet(merged, registrationStorageKeyRef.current);
          startRegistrationPolling();
        }

        if (onChainIds.length > 0) {
          const merged = new Set(onChainPendingRef.current);
          for (const id of onChainIds) {
            if (!onChainNotifiedRef.current.has(id)) {
              merged.add(id);
            }
          }
          onChainPendingRef.current = merged;
          saveIdSet(merged, onChainPendingKeyRef.current);
          startOnChainPolling();
        }
      })
      .catch(() => {
        // actions return [] on error
      });

    return () => {
      cancelled = true;
      clearRegistrationPolling();
      clearOnChainPolling();
    };
  }, [
    userId,
    clearRegistrationPolling,
    clearOnChainPolling,
    startRegistrationPolling,
    startOnChainPolling,
  ]);

  const value = useMemo<AgentCompletionContextValue>(
    () => ({
      addPendingRegistration,
      addPendingOnChainVerification,
    }),
    [addPendingRegistration, addPendingOnChainVerification],
  );

  return (
    <AgentCompletionContext.Provider value={value}>
      {children}
    </AgentCompletionContext.Provider>
  );
}
