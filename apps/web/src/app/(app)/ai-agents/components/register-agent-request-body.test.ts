import { describe, expect, it } from "vitest";

import {
  buildRegisterAgentDefaultValues,
  type RegisterAgentFormType,
} from "./register-agent-form-model";
import { buildRegisterAgentRequestBody } from "./register-agent-request-body";
import type { X402OptionDraft } from "./x402-options-section";

const option: X402OptionDraft = {
  caip2Network: "eip155:8453",
  asset: "0xasset",
  amount: "1000",
  decimals: "6",
  payTo: "0xpayto",
  resource: " https://a.example/paid ",
};

function values(
  overrides: Partial<RegisterAgentFormType> = {},
): RegisterAgentFormType {
  return {
    ...buildRegisterAgentDefaultValues("STANDARD", "lovelace"),
    name: "Agent",
    ...overrides,
  };
}

function build(
  data: RegisterAgentFormType,
  x402Options: X402OptionDraft[] = [],
) {
  return buildRegisterAgentRequestBody(data, {
    tags: ["a", "b"],
    x402Options,
    defaultPricingAssetId: "lovelace",
  });
}

describe("buildRegisterAgentRequestBody", () => {
  it("maps fixed standard pricing, payout address and EVM sources", () => {
    const body = build(
      values({
        apiUrl: "https://agent.example",
        prices: [
          { amount: " 5 ", asset: "" },
          { amount: "", asset: "usdm" },
        ],
        payoutAddress: " addr_test1 ",
      }),
      [option],
    );
    expect(body.apiUrl).toBe("https://agent.example");
    expect(body.tags).toBe("a, b");
    expect(body.pricing).toEqual({
      pricingType: "Fixed",
      prices: [{ amount: "5", currency: "lovelace" }],
    });
    expect(body.payoutAddress).toBe("addr_test1");
    expect(body.supportedPaymentSources).toEqual([
      {
        chain: "EVM",
        network: "eip155:8453",
        scheme: "Exact",
        payTo: "0xpayto",
        resource: "https://a.example/paid",
        pricing: {
          pricingType: "Fixed",
          fixed: [{ asset: "0xasset", amount: "1000", decimals: 6 }],
        },
      },
    ]);
  });

  it("sends x402 registrations as free with the first parsed resource URL", () => {
    const body = build(
      values({
        registrationKind: "X402_HTTP",
        pricingType: "Free",
        x402ResourceUrl: " https://a.example/paid ",
        apiUrl: "https://ignored.example",
        exampleOutputs: [{ name: "n", url: "u", mimeType: "m" }],
      }),
      [option],
    );
    expect(body.x402ResourceUrl).toBe("https://a.example/paid");
    expect(body.pricing).toEqual({ pricingType: "Free" });
    expect(body.apiUrl).toBeUndefined();
    expect(body.exampleOutputs).toBeUndefined();
    expect(body).not.toHaveProperty("payoutAddress");
    expect(body).not.toHaveProperty("supportedPaymentSources");
  });

  it("sends the API key only for a new Langdock connection", () => {
    const fresh = build(
      values({
        runtimeProvider: "LANGDOCK",
        pricingType: "Free",
        langdockApiKey: "key",
        langdockAgentId: "agent",
      }),
    );
    expect(fresh.langdockApiKey).toBe("key");
    expect(fresh.integrationConnectionId).toBeUndefined();
    expect(fresh.apiUrl).toBeUndefined();

    const saved = build(
      values({
        runtimeProvider: "LANGDOCK",
        pricingType: "Free",
        integrationConnectionId: "saved",
        langdockApiKey: "key",
      }),
    );
    expect(saved.langdockApiKey).toBeUndefined();
    expect(saved.integrationConnectionId).toBe("saved");
  });

  it("keeps only complete example outputs", () => {
    const body = build(
      values({
        pricingType: "Dynamic",
        exampleOutputs: [
          { name: "n", url: "u", mimeType: "m" },
          { name: "n", url: "", mimeType: "m" },
        ],
      }),
      [option],
    );
    expect(body.pricing).toEqual({ pricingType: "Dynamic" });
    expect(body.exampleOutputs).toEqual([
      { name: "n", url: "u", mimeType: "m" },
    ]);
    expect(body).not.toHaveProperty("supportedPaymentSources");
  });
});
