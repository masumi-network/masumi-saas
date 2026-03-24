"use client";

import { useEffect, useState } from "react";

import type { PaidTestingAgent } from "@/components/developers/testing/payment-form-fields";
import {
  extractErrorMessage,
  getAgentPricingType,
} from "@/lib/developers/testing-utils";

export function usePaidAgentsForTesting(): {
  agents: PaidTestingAgent[];
  isLoading: boolean;
  error: string | null;
} {
  const [agents, setAgents] = useState<PaidTestingAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          "/api/agents?take=50&registrationState=RegistrationConfirmed",
          { credentials: "include" },
        );
        const text = await res.text();
        let json: { success?: boolean; data?: unknown; error?: string };
        try {
          json = JSON.parse(text) as typeof json;
        } catch {
          throw new Error("Invalid agents response");
        }
        if (!res.ok || json.success === false) {
          throw new Error(
            typeof json.error === "string" ? json.error : `HTTP ${res.status}`,
          );
        }
        const rows = Array.isArray(json.data) ? json.data : [];
        const paid: PaidTestingAgent[] = [];
        for (const row of rows) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, unknown>;
          if (r.registrationState !== "RegistrationConfirmed") continue;
          const id = typeof r.id === "string" ? r.id : "";
          const name = typeof r.name === "string" ? r.name : id;
          const agentIdentifier =
            typeof r.agentIdentifier === "string" ? r.agentIdentifier : "";
          if (agentIdentifier.length < 57) continue;
          if (getAgentPricingType(r.pricing) === "Free") continue;
          paid.push({ id, name, agentIdentifier });
        }
        if (!cancelled) setAgents(paid);
      } catch (e) {
        if (!cancelled) {
          setError(extractErrorMessage(e, "Failed to load agents"));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { agents, isLoading, error };
}
