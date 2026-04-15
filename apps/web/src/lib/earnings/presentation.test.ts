import { describe, expect, it, vi } from "vitest";

import {
  filterMeaningfulEarningsSeries,
  formatResolvedEarningsPeriodLabel,
  getDefaultCustomDates,
} from "./presentation";

describe("earnings presentation helpers", () => {
  it("preserves empty-period calendar dates outside UTC", () => {
    expect(
      formatResolvedEarningsPeriodLabel({
        startDate: "2026-04-08",
        endDate: "2026-04-14",
        periodStart: null,
        periodEnd: null,
        timeZone: "America/Los_Angeles",
      }),
    ).toBe("Apr 8, 2026 – Apr 14, 2026");
  });

  it("uses the viewer time zone for default custom dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:30:00.000Z"));

    expect(getDefaultCustomDates("America/Los_Angeles")).toEqual({
      startDate: "2026-03-15",
      endDate: "2026-04-14",
    });

    vi.useRealTimers();
  });

  it("filters zero-filled series rows while preserving real raw-unit entries", () => {
    expect(
      filterMeaningfulEarningsSeries([
        { amount: 0, blockchainFees: 0, units: [] },
        {
          amount: 0,
          blockchainFees: 0,
          units: [{ amount: 4000000 }],
        },
        {
          amount: 0,
          blockchainFees: 100000,
          units: [],
        },
      ]),
    ).toEqual([
      {
        amount: 0,
        blockchainFees: 0,
        units: [{ amount: 4000000 }],
      },
      {
        amount: 0,
        blockchainFees: 100000,
        units: [],
      },
    ]);
  });
});
