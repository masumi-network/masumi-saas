import { describe, expect, it } from "vitest";

import type { X402Network } from "@/lib/x402/types";

import { chainsForEnv, isTestnetEnv, isX402SetUpForEnv } from "./x402-rail";

function chain(
  overrides: Partial<X402Network> & Pick<X402Network, "id" | "isTestnet">,
): X402Network {
  return {
    caip2Id: "eip155:8453",
    displayName: "Base",
    rpcUrl: "https://example.com",
    isEnabled: true,
    defaultAsset: null,
    facilitatorWalletId: "wallet-1",
    facilitatorWalletAddress: "0x1111111111111111111111111111111111111111",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("x402-rail environment pairing", () => {
  const chains = [
    chain({ id: "base-sepolia", isTestnet: true, caip2Id: "eip155:84532" }),
    chain({ id: "base-mainnet", isTestnet: false }),
    chain({
      id: "disabled-mainnet",
      isTestnet: false,
      isEnabled: false,
    }),
  ];

  it("pairs testnet chains with Preprod and mainnet chains with Mainnet", () => {
    expect(chainsForEnv(chains, "Preprod").map((c) => c.id)).toEqual([
      "base-sepolia",
    ]);
    expect(chainsForEnv(chains, "Mainnet").map((c) => c.id)).toEqual([
      "base-mainnet",
    ]);
  });

  it("detects setup when a usable chain exists for the environment", () => {
    expect(isX402SetUpForEnv(chains, "Preprod")).toBe(true);
    expect(isX402SetUpForEnv(chains, "Mainnet")).toBe(true);
    expect(
      isX402SetUpForEnv(
        [
          chain({
            id: "no-facilitator",
            isTestnet: false,
            facilitatorWalletId: null,
          }),
        ],
        "Mainnet",
      ),
    ).toBe(false);
  });

  it("maps Cardano network to isTestnet", () => {
    expect(isTestnetEnv("Preprod")).toBe(true);
    expect(isTestnetEnv("Mainnet")).toBe(false);
  });
});
