import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/verification.config", () => ({
  isAgentVerificationFlowEnabled: () => true,
}));

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

  it("maps agent type and pricing filters to API query params", () => {
    expect(
      agentListFiltersToApi({
        agentType: "x402",
        pricingType: "free",
      }),
    ).toEqual({
      agentType: "x402",
      pricingType: "free",
    });
  });

  it("counts active registration and verification filters", () => {
    expect(
      countAgentListFilters({
        registration: "registered",
        verification: "verified",
      }),
    ).toBe(2);
  });

  it("counts agent type and pricing filters", () => {
    expect(
      countAgentListFilters({
        agentType: "standard",
        pricingType: "dynamic",
      }),
    ).toBe(2);
  });

  it("parses filters from search params", () => {
    const params = new URLSearchParams(
      "verification=revoked&registration=pending&agentType=x402&pricingType=fixed",
    );
    expect(parseAgentListFilters(params)).toEqual({
      registration: "pending",
      verification: "revoked",
      agentType: "x402",
      pricingType: "fixed",
    });
  });
});
