import { describe, expect, it } from "vitest";

import { prepareSupportedPaymentSourcesForRegistration } from "@/lib/agent-registration";

const PREPROD_CONTRACT =
  "addr_test1qqexampleqqexampleqqexampleqqexampleqqexampleqqexampleqqexampleqqexample";

const evmSource = {
  chain: "EVM" as const,
  network: "eip155:84532",
  scheme: "Exact" as const,
  payTo: "0x1111111111111111111111111111111111111111",
  pricing: {
    pricingType: "Fixed" as const,
    fixed: [
      {
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        amount: "10000",
        decimals: 6,
      },
    ],
  },
};

describe("prepareSupportedPaymentSourcesForRegistration", () => {
  it("returns the default Cardano escrow source when no user sources are submitted", () => {
    const merged = prepareSupportedPaymentSourcesForRegistration(
      "Preprod",
      PREPROD_CONTRACT,
      [],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      chain: "Cardano",
      address: PREPROD_CONTRACT,
      pricing: { pricingType: "Free" },
    });
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
      PREPROD_CONTRACT,
      [evmSource],
    );

    expect(merged).toHaveLength(2);
    expect(merged?.[0]?.chain).toBe("Cardano");
    expect(merged?.[0]).toMatchObject({
      pricing: { pricingType: "Free" },
    });
    expect(merged?.[1]?.chain).toBe("EVM");
    expect(merged?.[1]).toMatchObject({
      extra: { assetTransferMethod: "permit2", decimals: 6 },
    });
  });
});
