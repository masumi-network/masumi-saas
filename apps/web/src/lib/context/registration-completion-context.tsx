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

import {
  completeRegistrationIfReadyAction,
  getPendingRegistrationAgentIdsAction,
} from "@/lib/actions/agent.action";
import { useSession } from "@/lib/auth/auth.client";
import { useNotifications } from "@/lib/context/notifications-context";
import z from "zod";

const POLL_INTERVAL_MS = 5_000;
/** Delay before first tick after adding a pending agent so dispenser UTXOs can land. */
const FIRST_TICK_DELAY_MS = 2_000;
/** Stop polling an agent after this many attempts (~3 min at 5s interval). */
const MAX_POLL_ATTEMPTS = 36;
const EVENT_AGENT_REGISTRATION_COMPLETE = "agent-registration-complete";
const PENDING_STORAGE_KEY_PREFIX = "masumi-pending-registration-ids";
const RETRY_COUNTS_STORAGE_KEY_PREFIX = "masumi-pending-registration-retries";

function getStorageKey(userId: string | null): string | null {
  return userId ? `${PENDING_STORAGE_KEY_PREFIX}-${userId}` : null;
}

function getRetryCountsStorageKey(userId: string | null): string | null {
  return userId ? `${RETRY_COUNTS_STORAGE_KEY_PREFIX}-${userId}` : null;
}

const pendingAgentSchema = z.array(z.string());

function loadPendingFromStorage(storageKey: string | null): Set<string> {
  if (typeof window === "undefined" || !storageKey) return new Set();
  try {
    const raw = sessionStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    const result = pendingAgentSchema.safeParse(parsed);
    if (result.success) {
      return new Set(result.data);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function loadRetryCountsFromStorage(
  retryKey: string | null,
): Map<string, number> {
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

function savePendingToStorage(
  ids: Set<string>,
  storageKey: string | null,
): void {
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

function saveRetryCountsToStorage(
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

export type RegistrationCompletionContextValue = {
  addPendingAgent: (agentId: string) => void;
};

const RegistrationCompletionContext =
  createContext<RegistrationCompletionContextValue | null>(null);

export function useRegistrationCompletion(): RegistrationCompletionContextValue {
  const ctx = useContext(RegistrationCompletionContext);
  if (!ctx) {
    throw new Error(
      "useRegistrationCompletion must be used within RegistrationCompletionProvider",
    );
  }
  return ctx;
}

export function RegistrationCompletionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("App.Notifications");
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const storageKey = getStorageKey(userId);

  const pendingRef = useRef<Set<string>>(new Set());

  const isPollingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstTickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const tRef = useRef(t);
  tRef.current = t;
  const { addNotification } = useNotifications();
  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  const runTickRef = useRef<(() => void) | null>(null);
  const storageKeyRef = useRef<string | null>(null);
  const retryKeyRef = useRef<string | null>(null);
  storageKeyRef.current = storageKey;
  retryKeyRef.current = getRetryCountsStorageKey(userId);

  const clearPollingInterval = useCallback(() => {
    if (firstTickTimeoutRef.current !== null) {
      clearTimeout(firstTickTimeoutRef.current);
      firstTickTimeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Clear in-memory pending when user logs out so next user doesn't inherit.
  useEffect(() => {
    if (!storageKey) {
      pendingRef.current = new Set();
    }
  }, [storageKey]);

  const addPendingAgent = useCallback(
    (agentId: string) => {
      const next = new Set(pendingRef.current);
      next.add(agentId);
      pendingRef.current = next;
      savePendingToStorage(next, storageKeyRef.current);
      clearPollingInterval();
      intervalRef.current = setInterval(() => {
        runTickRef.current?.();
      }, POLL_INTERVAL_MS);
      // Delay first tick so dispenser UTXOs are visible before we call complete-registration.
      firstTickTimeoutRef.current = setTimeout(() => {
        firstTickTimeoutRef.current = null;
        runTickRef.current?.();
      }, FIRST_TICK_DELAY_MS);
    },
    [clearPollingInterval],
  );

  // Define tick and set runTickRef only; do not start interval on mount.
  useEffect(() => {
    const tick = async () => {
      if (pendingRef.current.size === 0) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      if (isPollingRef.current) return;
      const ids = Array.from(pendingRef.current);
      if (ids.length === 0) return;

      isPollingRef.current = true;
      try {
        const toPoll: string[] = [];
        for (const agentId of ids) {
          const attempts = (retryCountRef.current.get(agentId) ?? 0) + 1;
          retryCountRef.current.set(agentId, attempts);
          if (attempts > MAX_POLL_ATTEMPTS) {
            const next = new Set(pendingRef.current);
            next.delete(agentId);
            pendingRef.current = next;
            retryCountRef.current.delete(agentId);
            savePendingToStorage(next, storageKeyRef.current);
            saveRetryCountsToStorage(
              retryCountRef.current,
              retryKeyRef.current,
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
        saveRetryCountsToStorage(retryCountRef.current, retryKeyRef.current);
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
          if (settled.status === "fulfilled") {
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
        }
        if (toRemove.length > 0) {
          const next = new Set(pendingRef.current);
          for (const { agentId } of toRemove) {
            next.delete(agentId);
            retryCountRef.current.delete(agentId);
          }
          pendingRef.current = next;
          savePendingToStorage(next, storageKeyRef.current);
          saveRetryCountsToStorage(retryCountRef.current, retryKeyRef.current);
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
        }
      } finally {
        isPollingRef.current = false;
      }
    };
    runTickRef.current = () => void tick();
    return clearPollingInterval;
  }, [clearPollingInterval]);

  // Hydrate from sessionStorage and recover stuck agents from server; start polling when we have pending IDs.
  useEffect(() => {
    if (!storageKey) return clearPollingInterval;

    const startPolling = () => {
      clearPollingInterval();
      intervalRef.current = setInterval(() => {
        runTickRef.current?.();
      }, POLL_INTERVAL_MS);
      firstTickTimeoutRef.current = setTimeout(() => {
        firstTickTimeoutRef.current = null;
        runTickRef.current?.();
      }, FIRST_TICK_DELAY_MS);
    };

    const stored = loadPendingFromStorage(storageKey);
    const retryKey = getRetryCountsStorageKey(userId);
    const storedRetries = loadRetryCountsFromStorage(retryKey);
    for (const [id, count] of storedRetries) {
      retryCountRef.current.set(id, count);
    }
    const next = new Set([...pendingRef.current, ...stored]);
    pendingRef.current = next;
    savePendingToStorage(next, storageKey);
    if (next.size > 0) startPolling();

    let cancelled = false;
    getPendingRegistrationAgentIdsAction()
      .then((serverIds) => {
        if (cancelled) return;
        if (serverIds.length === 0) return;
        const merged = new Set([...pendingRef.current, ...serverIds]);
        pendingRef.current = merged;
        savePendingToStorage(merged, storageKeyRef.current);
        if (merged.size > 0) startPolling();
      })
      .catch(() => {
        // Ignore: action returns [] on error; avoid unhandled rejection
      });

    return () => {
      cancelled = true;
      clearPollingInterval();
    };
  }, [storageKey, userId, clearPollingInterval]);

  const value = useMemo<RegistrationCompletionContextValue>(
    () => ({ addPendingAgent }),
    [addPendingAgent],
  );

  return (
    <RegistrationCompletionContext.Provider value={value}>
      {children}
    </RegistrationCompletionContext.Provider>
  );
}

export { EVENT_AGENT_REGISTRATION_COMPLETE };
