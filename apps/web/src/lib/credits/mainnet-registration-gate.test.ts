import { describe, expect, it } from "vitest";

import { checkMainnetRegistrationCredits } from "./mainnet-registration-gate";

describe("checkMainnetRegistrationCredits", () => {
  it("allows Preprod regardless of balance", () => {
    expect(
      checkMainnetRegistrationCredits({
        network: "Preprod",
        creditsRemaining: 0,
        registrationsNeeded: 5,
      }).ok,
    ).toBe(true);
  });

  it("allows Mainnet when no new registrations are needed", () => {
    expect(
      checkMainnetRegistrationCredits({
        network: "Mainnet",
        creditsRemaining: 0,
        registrationsNeeded: 0,
      }).ok,
    ).toBe(true);
  });

  it("rejects Mainnet when balance is zero but registrations are needed", () => {
    const result = checkMainnetRegistrationCredits({
      network: "Mainnet",
      creditsRemaining: 0,
      registrationsNeeded: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("insufficient_credits");
  });

  it("rejects when batch needs more credits than affordable", () => {
    const result = checkMainnetRegistrationCredits({
      network: "Mainnet",
      creditsRemaining: 2,
      registrationsNeeded: 5,
      maxPerBatch: 100,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "exceeds_affordable",
      affordable: 2,
    });
  });
});
