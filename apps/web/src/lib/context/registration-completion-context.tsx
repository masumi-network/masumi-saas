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

import { completeRegistrationIfReadyAction } from "@/lib/actions/agent.action";
import { useNotifications } from "@/lib/context/notifications-context";

const POLL_INTERVAL_MS = 5_000;
/** Stop polling an agent after this many attempts (~3 min at 5s interval). */
const MAX_POLL_ATTEMPTS = 36;
const EVENT_AGENT_REGISTRATION_COMPLETE = "agent-registration-complete";
const PENDING_STORAGE_KEY = "masumi-pending-registration-ids";

function loadPendingFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function savePendingToStorage(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(ids);
    if (arr.length === 0) {
      sessionStorage.removeItem(PENDING_STORAGE_KEY);
    } else {
      sessionStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(arr));
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
  const pendingRef = useRef<Set<string>>(new Set());

  const isPollingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const tRef = useRef(t);
  tRef.current = t;
  const { addNotification } = useNotifications();
  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  const runTickRef = useRef<(() => void) | null>(null);

  const addPendingAgent = useCallback((agentId: string) => {
    const next = new Set(pendingRef.current);
    next.add(agentId);
    pendingRef.current = next;
    savePendingToStorage(next);
    if (intervalRef.current === null) {
      intervalRef.current = setInterval(() => {
        runTickRef.current?.();
      }, POLL_INTERVAL_MS);
      runTickRef.current?.();
    }
  }, []);

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
            savePendingToStorage(next);
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
          savePendingToStorage(next);
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
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Hydrate from sessionStorage; start polling only when we have pending IDs.
  useEffect(() => {
    const stored = loadPendingFromStorage();
    if (stored.size > 0) {
      pendingRef.current = new Set([...pendingRef.current, ...stored]);
      savePendingToStorage(pendingRef.current);
      if (intervalRef.current === null) {
        intervalRef.current = setInterval(() => {
          runTickRef.current?.();
        }, POLL_INTERVAL_MS);
        runTickRef.current?.();
      }
    }
  }, []);

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
