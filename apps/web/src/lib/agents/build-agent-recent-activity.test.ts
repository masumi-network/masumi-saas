import { describe, expect, it } from "vitest";

import {
  type AgentRecentActivityItem,
  mergeAgentRecentActivityLifecycle,
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

describe("mergeAgentRecentActivityLifecycle", () => {
  it("uses DB registry events instead of synthetic timeline when history exists", () => {
    const timeline = [
      {
        kind: "lifecycle" as const,
        id: "timeline:RegistrationRequested",
        date: "2020-01-01T00:00:00.000Z",
        eventKey: "RegistrationRequested",
        timelineStatus: "complete" as const,
      },
      {
        kind: "lifecycle" as const,
        id: "timeline:RegistrationConfirmed",
        date: "2020-01-02T00:00:00.000Z",
        eventKey: "RegistrationConfirmed",
        timelineStatus: "complete" as const,
      },
      {
        kind: "lifecycle" as const,
        id: "timeline:DeregistrationConfirmed",
        date: "2020-01-02T00:00:00.000Z",
        eventKey: "DeregistrationConfirmed",
        timelineStatus: "complete" as const,
      },
    ];
    const db = [
      {
        kind: "lifecycle" as const,
        id: "db-1",
        date: "2026-01-01T10:00:00.000Z",
        eventKey: "RegistrationRequested",
      },
      {
        kind: "lifecycle" as const,
        id: "db-2",
        date: "2026-01-01T11:00:00.000Z",
        eventKey: "RegistrationConfirmed",
      },
      {
        kind: "lifecycle" as const,
        id: "db-3",
        date: "2026-01-01T12:00:00.000Z",
        eventKey: "DeregistrationRequested",
      },
      {
        kind: "lifecycle" as const,
        id: "db-4",
        date: "2026-01-01T12:30:00.000Z",
        eventKey: "DeregistrationConfirmed",
      },
    ];
    const merged = mergeAgentRecentActivityLifecycle({
      timeline,
      db,
      dbRawTypes: [
        "RegistrationInitiated",
        "RegistrationConfirmed",
        "DeregistrationRequested",
        "DeregistrationConfirmed",
      ],
      registrationState: "DeregistrationConfirmed",
    });
    expect(merged.map((i) => i.id)).toEqual(["db-1", "db-2", "db-3", "db-4"]);
  });

  it("does not show in-flight confirmed steps as completed milestones", () => {
    const timeline = [
      {
        kind: "lifecycle" as const,
        id: "timeline:RegistrationRequested",
        date: "2026-01-01T10:00:00.000Z",
        eventKey: "RegistrationRequested",
        timelineStatus: "complete" as const,
      },
      {
        kind: "lifecycle" as const,
        id: "timeline:RegistrationConfirmed",
        date: "2026-01-01T10:01:00.000Z",
        eventKey: "RegistrationConfirmed",
        timelineStatus: "current" as const,
      },
    ];
    const db = [
      {
        kind: "lifecycle" as const,
        id: "db-1",
        date: "2026-01-01T10:00:00.000Z",
        eventKey: "RegistrationRequested",
      },
    ];
    const merged = mergeAgentRecentActivityLifecycle({
      timeline,
      db,
      dbRawTypes: ["RegistrationInitiated"],
      registrationState: "RegistrationInitiated",
    });
    expect(merged.map((i) => i.eventKey)).toEqual(["RegistrationRequested"]);
  });

  it("dedupes duplicate registration confirmed rows", () => {
    const merged = mergeAgentRecentActivityLifecycle({
      timeline: [],
      db: [
        {
          kind: "lifecycle" as const,
          id: "db-old",
          date: "2026-01-01T10:00:00.000Z",
          eventKey: "RegistrationConfirmed",
        },
        {
          kind: "lifecycle" as const,
          id: "db-new",
          date: "2026-01-01T10:00:01.000Z",
          eventKey: "RegistrationConfirmed",
        },
      ],
      dbRawTypes: ["RegistrationConfirmed", "RegistrationConfirmed"],
      registrationState: "RegistrationConfirmed",
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("db-new");
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
