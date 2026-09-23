import { describe, expect, it } from "vitest";

import {
  agentListFiltersToApi,
  countAgentListFilters,
  parseAgentListFilters,
} from "./agents-filters-popover";

describe("agents list filters", () => {
  it("maps verification filters to API query params", () => {
    expect(
      agentListFiltersToApi({
        verification: "verified",
      }),
    ).toEqual({ verificationStatus: "VERIFIED" });

    expect(
      agentListFiltersToApi({
        verification: "pending",
      }),
    ).toEqual({ verificationStatus: "PENDING" });

    expect(
      agentListFiltersToApi({
        verification: "unverified",
      }),
    ).toEqual({ unverified: true });
  });

  it("counts active registration and verification filters", () => {
    expect(
      countAgentListFilters({
        registration: "registered",
        verification: "verified",
      }),
    ).toBe(2);
  });

  it("parses verification from search params", () => {
    const params = new URLSearchParams(
      "verification=revoked&registration=pending",
    );
    expect(parseAgentListFilters(params)).toEqual({
      registration: "pending",
      verification: "revoked",
    });
  });
});
