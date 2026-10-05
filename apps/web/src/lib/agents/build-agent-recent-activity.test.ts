import { describe, expect, it } from "vitest";

import {
  type AgentRecentActivityItem,
  paginateAgentRecentActivity,
  sortAgentRecentActivityItems,
} from "./build-agent-recent-activity";

describe("sortAgentRecentActivityItems", () => {
  it("sorts newest first", () => {
    const items: AgentRecentActivityItem[] = [
      {
        kind: "lifecycle",
        id: "a",
        date: "2024-01-01T00:00:00.000Z",
        eventKey: "RegistrationRequested",
      },
      {
        kind: "transaction",
        id: "b",
        date: "2024-06-01T00:00:00.000Z",
        txType: "payment",
        amount: "1 ADA",
        status: "FundsLocked",
        txHash: null,
      },
    ];
    const sorted = sortAgentRecentActivityItems(items);
    expect(sorted[0]?.id).toBe("b");
    expect(sorted[1]?.id).toBe("a");
  });
});

describe("paginateAgentRecentActivity", () => {
  const items: AgentRecentActivityItem[] = Array.from(
    { length: 25 },
    (_, i) => ({
      kind: "lifecycle" as const,
      id: String(i),
      date: new Date(2024, 0, 25 - i).toISOString(),
      eventKey: "RegistrationRequested",
    }),
  );

  it("returns 10 items per page", () => {
    const page1 = paginateAgentRecentActivity(items, 1, 10);
    expect(page1.items).toHaveLength(10);
    expect(page1.totalCount).toBe(25);
    expect(page1.totalPages).toBe(3);
    expect(page1.page).toBe(1);
  });

  it("clamps page above totalPages", () => {
    const last = paginateAgentRecentActivity(items, 99, 10);
    expect(last.page).toBe(3);
    expect(last.items).toHaveLength(5);
  });
});
