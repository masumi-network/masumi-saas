import { describe, expect, it } from "vitest";

import {
  creditsRequiredForRegistrations,
  maxAgentRegistrationsForBalance,
} from "./agent-registration-quota";

describe("maxAgentRegistrationsForBalance", () => {
  it("caps Mainnet by credits (1 per agent)", () => {
    expect(
      maxAgentRegistrationsForBalance({
        network: "Mainnet",
        creditsRemaining: 20,
        maxPerBatch: 100,
      }),
    ).toBe(20);
    expect(
      maxAgentRegistrationsForBalance({
        network: "Mainnet",
        creditsRemaining: 3,
        maxPerBatch: 100,
      }),
    ).toBe(3);
    expect(
      maxAgentRegistrationsForBalance({
        network: "Mainnet",
        creditsRemaining: 0,
        maxPerBatch: 100,
      }),
    ).toBe(0);
  });

  it("ignores credits on Preprod", () => {
    expect(
      maxAgentRegistrationsForBalance({
        network: "Preprod",
        creditsRemaining: 0,
        maxPerBatch: 100,
      }),
    ).toBe(100);
  });

  it("respects batch hard cap", () => {
    expect(
      maxAgentRegistrationsForBalance({
        network: "Mainnet",
        creditsRemaining: 500,
        maxPerBatch: 100,
      }),
    ).toBe(100);
  });
});

describe("creditsRequiredForRegistrations", () => {
  it("scales linearly", () => {
    expect(creditsRequiredForRegistrations(0)).toBe(0);
    expect(creditsRequiredForRegistrations(5)).toBe(5);
  });
});
