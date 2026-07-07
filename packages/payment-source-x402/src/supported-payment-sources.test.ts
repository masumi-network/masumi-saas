import { describe, expect, it } from "vitest";

import { serializeSupportedPaymentSources } from "./supported-payment-sources.js";

describe("serializeSupportedPaymentSources", () => {
  it("fills default registry extra when persisted EVM row has null extra", () => {
    const serialized = serializeSupportedPaymentSources([
      {
        id: "sps-1",
        chain: "EVM",
        network: "eip155:10143",
        paymentSourceType: null,
        address: "0x313735C22cB624d7Be4B46f95097C4DAb47bb9ae",
        scheme: "Exact",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        amount: 100000n,
        decimals: 6,
        payTo: "0x313735C22cB624d7Be4B46f95097C4DAb47bb9ae",
        resource: null,
        extra: null,
      },
    ]);

    expect(serialized).toHaveLength(1);
    expect(serialized?.[0]).toMatchObject({
      chain: "EVM",
      extra: { assetTransferMethod: "permit2", decimals: 6 },
    });
  });
});
