import { supportedPaymentSourceSchema } from "@masumi/payment-source-x402/payment-source";
import { describe, expect, it } from "vitest";

import { registryEntrySchema } from "./registry-schemas";

const source = {
  id: "payment-node-source",
  chain: "EVM",
  network: "eip155:84532",
  scheme: "Exact",
  payTo: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  pricing: {
    pricingType: "Fixed",
    fixed: [
      {
        asset: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        amount: "100",
        decimals: 6,
      },
    ],
  },
};

describe("registry payment source response IDs", () => {
  it("preserves IDs only when reading a registry entry", () => {
    const read = registryEntrySchema.shape.supportedPaymentSources.parse([
      source,
    ]);
    expect(read?.[0]?.id).toBe(source.id);
    expect(supportedPaymentSourceSchema.parse(source)).not.toHaveProperty("id");
  });

  it("accepts older node output without IDs and null legacy sources", () => {
    expect(
      registryEntrySchema.shape.supportedPaymentSources.parse([
        { ...source, id: undefined },
      ])?.[0]?.id,
    ).toBeUndefined();
    expect(
      registryEntrySchema.shape.supportedPaymentSources.parse(null),
    ).toBeNull();
  });

  it("retains source array bounds", () => {
    expect(
      registryEntrySchema.shape.supportedPaymentSources.safeParse([]).success,
    ).toBe(false);
    expect(
      registryEntrySchema.shape.supportedPaymentSources.safeParse(
        Array.from({ length: 26 }, () => source),
      ).success,
    ).toBe(false);
  });
});
