import { describe, expect, it } from "vitest";

import {
  assessSokosumiBuySideCompatibility,
  parsePaymentRequiredHeader,
  probeX402HttpResource,
} from "./http-resource-probe.js";

describe("parsePaymentRequiredHeader", () => {
  it("parses base64 JSON", () => {
    const payload = { accepts: [{ network: "eip155:8453", scheme: "exact" }] };
    const header = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64",
    );
    expect(parsePaymentRequiredHeader(header)).toEqual(payload);
  });
});

describe("assessSokosumiBuySideCompatibility", () => {
  it("accepts exact + absent transfer method with trusted USDC domain", () => {
    const accept = {
      network: "eip155:8453",
      scheme: "exact",
      asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      payTo: "0xabc",
      amount: "1000",
      maxTimeoutSeconds: 3600,
      extra: { name: "USD Coin", version: "2" },
    };
    const result = assessSokosumiBuySideCompatibility([accept], accept);
    expect(result.compatible).toBe(true);
  });

  it("rejects permit2", () => {
    const accept = {
      network: "eip155:8453",
      scheme: "exact",
      asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      payTo: "0xabc",
      amount: "1000",
      maxTimeoutSeconds: 3600,
      extra: {
        name: "USD Coin",
        version: "2",
        assetTransferMethod: "permit2",
      },
    };
    const result = assessSokosumiBuySideCompatibility([accept], accept);
    expect(result.compatible).toBe(false);
  });
});

describe("probeX402HttpResource", () => {
  it("reads accepts from a 402 JSON body", async () => {
    const accepts = [
      {
        network: "eip155:84532",
        scheme: "exact",
        asset: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
        payTo: "0x1234567890123456789012345678901234567890",
        amount: "10000",
        maxTimeoutSeconds: 3600,
        extra: { name: "USDC", version: "2" },
      },
    ];
    const result = await probeX402HttpResource({
      resourceUrl: "https://example.test/resource",
      evmNetwork: "eip155:84532",
      fetchImpl: async () =>
        new Response(JSON.stringify({ accepts, x402Version: 2 }), {
          status: 402,
          headers: { "content-type": "application/json" },
        }),
    });

    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (result.ok) {
      expect(result.row.amount).toBe("10000");
      expect(result.row.sokosumiCompatible).toBe(true);
    }
  });
});

it("selects compatible USDC when another exact token appears first", async () => {
  const compatible = {
    network: "eip155:8453",
    scheme: "exact",
    asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    payTo: "0x1234567890123456789012345678901234567890",
    amount: "1000",
    maxTimeoutSeconds: 3600,
    extra: { name: "USD Coin", version: "2" },
  };
  const other = {
    ...compatible,
    asset: "0x1111111111111111111111111111111111111111",
    extra: { name: "Other Token", version: "1" },
  };
  const result = await probeX402HttpResource({
    resourceUrl: "https://example.com/paid",
    evmNetwork: compatible.network,
    fetchImpl: async () =>
      new Response(JSON.stringify({ accepts: [other, compatible] }), {
        status: 402,
      }),
  });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.row.asset).toBe(compatible.asset);
});
