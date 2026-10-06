import { describe, expect, it } from "vitest";

import {
  filterAgentTransactionsOnOrAfterCutoff,
  resolveAgentActivityTransactionCutoff,
} from "./agent-activity-transaction-cutoff";

describe("resolveAgentActivityTransactionCutoff", () => {
  it("uses the latest RegistrationInitiated event after first-time initiatedAt", () => {
    const created = new Date("2024-01-01T00:00:00.000Z");
    const firstInitiated = new Date("2024-01-01T01:00:00.000Z");
    const reRegister = new Date("2026-01-01T09:00:00.000Z");

    const cutoff = resolveAgentActivityTransactionCutoff({
      agentCreatedAt: created,
      registrationInitiatedAt: firstInitiated,
      registrationInitiatedEventsNewestFirst: [reRegister, firstInitiated],
    });

    expect(cutoff.toISOString()).toBe(reRegister.toISOString());
  });

  it("falls back to agent createdAt when no registration markers exist", () => {
    const created = new Date("2025-06-15T12:00:00.000Z");
    const cutoff = resolveAgentActivityTransactionCutoff({
      agentCreatedAt: created,
      registrationInitiatedAt: null,
      registrationInitiatedEventsNewestFirst: [],
    });
    expect(cutoff.toISOString()).toBe(created.toISOString());
  });
});

describe("filterAgentTransactionsOnOrAfterCutoff", () => {
  it("drops transactions before the cutoff", () => {
    const cutoff = new Date("2026-01-01T00:00:00.000Z");
    const kept = filterAgentTransactionsOnOrAfterCutoff(
      [
        { id: "old", createdAt: "2025-12-01T00:00:00.000Z" },
        { id: "new", createdAt: "2026-01-02T00:00:00.000Z" },
      ],
      cutoff,
    );
    expect(kept.map((t) => t.id)).toEqual(["new"]);
  });
});
