import { describe, expect, it } from "vitest";

import {
  normalizeChainSearchQuery,
  pickPreferredRpcUrl,
  searchChainRegistry,
} from "./chain-registry-search";
import type { ChainRegistryEntry } from "./chain-registry-types";

const sampleEntries: ChainRegistryEntry[] = [
  {
    chainId: 1,
    caip2Id: "eip155:1",
    name: "Ethereum Mainnet",
    shortName: "eth",
    isTestnet: false,
    rpcUrl: "https://ethereum.publicnode.com",
    icon: "ethereum",
    isCurated: true,
  },
  {
    chainId: 8453,
    caip2Id: "eip155:8453",
    name: "Base",
    shortName: "base",
    isTestnet: false,
    rpcUrl: "https://mainnet.base.org",
    icon: "base",
    isCurated: true,
  },
  {
    chainId: 11155111,
    caip2Id: "eip155:11155111",
    name: "Ethereum Sepolia",
    shortName: "sep",
    isTestnet: true,
    rpcUrl: "https://ethereum-sepolia.publicnode.com",
    icon: "ethereum",
    isCurated: true,
  },
];

describe("chain-registry-search", () => {
  it("normalizes numeric and caip2 queries", () => {
    expect(normalizeChainSearchQuery("8453")).toEqual({
      text: "8453",
      chainId: 8453,
    });
    expect(normalizeChainSearchQuery("eip155:8453")).toEqual({
      text: "eip155:8453",
      chainId: 8453,
    });
  });

  it("searches by name and chain id", () => {
    expect(
      searchChainRegistry(sampleEntries, "Base", { testnet: false }),
    ).toEqual([sampleEntries[1]]);
    expect(
      searchChainRegistry(sampleEntries, "8453", { testnet: false }),
    ).toEqual([sampleEntries[1]]);
    expect(
      searchChainRegistry(sampleEntries, "eip155:1", { testnet: false }),
    ).toEqual([sampleEntries[0]]);
  });

  it("does not match substrings inside unrelated words", () => {
    expect(
      searchChainRegistry(sampleEntries, "base", { testnet: false }),
    ).toEqual([sampleEntries[1]]);
  });

  it("filters by environment", () => {
    expect(
      searchChainRegistry(sampleEntries, "Ethereum", { testnet: true }),
    ).toEqual([sampleEntries[2]]);
  });

  it("prefers untracked https rpc urls", () => {
    expect(
      pickPreferredRpcUrl([
        "wss://example.com",
        { url: "https://tracked.example", tracking: "yes" },
        { url: "https://public.example", tracking: "none" },
      ]),
    ).toBe("https://public.example");
  });
});
