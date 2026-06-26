import { describe, expect, it } from "vitest";

import { prepareSupportedPaymentSourcesForRegistration } from "@/lib/agent-registration";

const evmSource = {
  chain: "EVM" as const,
  network: "eip155:84532",
  scheme: "Exact" as const,
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  amount: "10000",
  decimals: 6,
  payTo: "0x1111111111111111111111111111111111111111",
};

describe("prepareSupportedPaymentSourcesForRegistration", () => {
  it("returns null when no sources are submitted", () => {
    expect(
      prepareSupportedPaymentSourcesForRegistration("Preprod", "addr1...", []),
    ).toBeNull();
  });

  it("rejects x402 sources when the payment source has no smart contract", () => {
    expect(() =>
      prepareSupportedPaymentSourcesForRegistration("Preprod", null, [
        evmSource,
      ]),
    ).toThrow(/smart contract address/i);
  });

  it("merges Cardano default source and validates EVM options", () => {
    const merged = prepareSupportedPaymentSourcesForRegistration(
      "Preprod",
      "addr_test1qqexampleqqexampleqqexampleqqexampleqqexampleqqexampleqqexampleqqexample",
      [evmSource],
    );

    expect(merged).toHaveLength(2);
    expect(merged?.[0]?.chain).toBe("Cardano");
    expect(merged?.[1]?.chain).toBe("EVM");
  });
});
