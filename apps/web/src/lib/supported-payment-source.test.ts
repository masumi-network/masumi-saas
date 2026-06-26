import {
  PaymentSourceType,
  supportedPaymentSourceSchema,
  validateSupportedPaymentSourcesOrThrow,
} from "@masumi/payment-source-x402/payment-source";
import { describe, expect, it } from "vitest";

describe("supported payment sources", () => {
  it("accepts standard x402 EVM sources for V2 registry entries", () => {
    const parsed = supportedPaymentSourceSchema.parse({
      chain: "EVM",
      network: "eip155:84532",
      scheme: "Exact",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "10000",
      decimals: 6,
      payTo: "0x1111111111111111111111111111111111111111",
    });

    expect(() =>
      validateSupportedPaymentSourcesOrThrow(
        [parsed],
        "Preprod",
        PaymentSourceType.Web3CardanoV2,
      ),
    ).not.toThrow();
  });

  it("rejects invalid CAIP-2 network ids", () => {
    expect(() =>
      supportedPaymentSourceSchema.parse({
        chain: "EVM",
        network: "base-sepolia",
        scheme: "Exact",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        amount: "10000",
        decimals: 6,
        payTo: "0x1111111111111111111111111111111111111111",
      }),
    ).toThrow();
  });

  it("rejects x402 EVM address aliases that differ from payTo", () => {
    expect(() =>
      supportedPaymentSourceSchema.parse({
        chain: "EVM",
        network: "eip155:84532",
        address: "0x2222222222222222222222222222222222222222",
        scheme: "Exact",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        amount: "10000",
        decimals: 6,
        payTo: "0x1111111111111111111111111111111111111111",
      }),
    ).toThrow("x402 address alias must match payTo");
  });
});
