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

  // Hydrate pending IDs from sessionStorage; merge with ref so runtime additions before this runs are kept
  useEffect(() => {
    const stored = loadPendingFromStorage();
    if (stored.size > 0) {
      pendingRef.current = new Set([...pendingRef.current, ...stored]);
      savePendingToStorage(pendingRef.current);
    }
  }, []);

  const isPollingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const { addNotification } = useNotifications();
  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  // Tick ref so we can restart the interval from addPendingAgent when going 0 -> 1 pending.
  const runTickRef = useRef<() => void>(null!);

  const addPendingAgent = useCallback((agentId: string) => {
    const next = new Set(pendingRef.current);
    next.add(agentId);
    pendingRef.current = next;
    savePendingToStorage(next);
    if (intervalRef.current === null && runTickRef.current) {
      intervalRef.current = setInterval(runTickRef.current, POLL_INTERVAL_MS);
    }
  }, []);

  // Poll only while there are pending agents; clear interval when set becomes empty.
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
        for (const agentId of ids) {
          try {
            const result = await completeRegistrationIfReadyAction(agentId);
            if (result.status === "registered") {
              const next = new Set(pendingRef.current);
              next.delete(agentId);
              pendingRef.current = next;
              savePendingToStorage(next);
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
            } else if (result.status === "error") {
              const next = new Set(pendingRef.current);
              next.delete(agentId);
              pendingRef.current = next;
              savePendingToStorage(next);
              const errorMessage =
                result.error ?? tRef.current("registrationFailed");
              toast.error(errorMessage);
              addNotificationRef.current({
                type: "error",
                titleKey: "registrationFailed",
                link: {
                  href: `/ai-agents/${agentId}`,
                  labelKey: "viewAgent",
                },
              });
            }
          } catch {
            // Keep in pending; will retry next interval
          }
        }
      } finally {
        isPollingRef.current = false;
      }
    };
    const tickWrapper = () => void tick();
    runTickRef.current = tickWrapper;
    intervalRef.current = setInterval(tickWrapper, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
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
