"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { completeRegistrationIfReadyAction } from "@/lib/actions/agent.action";

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
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());

  const addPendingAgent = useCallback((agentId: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.add(agentId);
      pendingRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (pendingIds.size === 0) return;

    const intervalId = setInterval(async () => {
      const ids = Array.from(pendingRef.current);
      if (ids.length === 0) return;

      for (const agentId of ids) {
        try {
          const result = await completeRegistrationIfReadyAction(agentId);
          if (result.status === "registered") {
            setPendingIds((prev) => {
              const next = new Set(prev);
              next.delete(agentId);
              pendingRef.current = next;
              return next;
            });
            toast.success("Agent registered successfully!");
            window.dispatchEvent(
              new CustomEvent(EVENT_AGENT_REGISTRATION_COMPLETE, {
                detail: { agentId },
              }),
            );
          } else if (result.status === "error") {
            setPendingIds((prev) => {
              const next = new Set(prev);
              next.delete(agentId);
              pendingRef.current = next;
              return next;
            });
            toast.error(result.error ?? "Registration failed");
          }
        } catch {
          // Keep in pending; will retry next interval
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [pendingIds.size]);

  const value: RegistrationCompletionContextValue = {
    addPendingAgent,
  };

  return (
    <RegistrationCompletionContext.Provider value={value}>
      {children}
    </RegistrationCompletionContext.Provider>
  );
}

export { EVENT_AGENT_REGISTRATION_COMPLETE };
