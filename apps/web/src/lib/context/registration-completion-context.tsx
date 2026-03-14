"use client";

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
  const pendingRef = useRef<Set<string>>(new Set());
  const { addNotification } = useNotifications();
  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  const addPendingAgent = useCallback((agentId: string) => {
    const next = new Set(pendingRef.current);
    next.add(agentId);
    pendingRef.current = next;
  }, []);

  // Single long-lived interval: reads from pendingRef so we never restart when
  // pendingIds.size changes (which would overlap with in-flight async callbacks).
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const ids = Array.from(pendingRef.current);
      if (ids.length === 0) return;

      for (const agentId of ids) {
        try {
          const result = await completeRegistrationIfReadyAction(agentId);
          if (result.status === "registered") {
            const next = new Set(pendingRef.current);
            next.delete(agentId);
            pendingRef.current = next;
            toast.success("Agent registered successfully!");
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
            toast.error(result.error ?? "Registration failed");
          }
        } catch {
          // Keep in pending; will retry next interval
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
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
