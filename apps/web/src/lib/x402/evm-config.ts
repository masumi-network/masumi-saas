export type EvmStablecoinAddresses = {
  usdc?: string;
  usdt?: string;
};

export type EvmChainConfig = {
  /** Stable key for UI / tests */
  id: string;
  caip2Id: string;
  displayName: string;
  /** Compact label for autofill chips */
  shortName: string;
  rpcUrl: string;
  isTestnet: boolean;
  stablecoins: EvmStablecoinAddresses;
};

/** Curated EVM chains for x402 setup (CAIP-2 ids, public RPCs, common stablecoins). */
export const EVM_CHAINS: readonly EvmChainConfig[] = [
  {
    id: "base",
    caip2Id: "eip155:8453",
    displayName: "Base",
    shortName: "Base",
    rpcUrl: "https://mainnet.base.org",
    isTestnet: false,
    stablecoins: {
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      usdt: "0xfde4C96c8593536E31F229EA8f367978e6E846242",
    },
  },
  {
    id: "ethereum",
    caip2Id: "eip155:1",
    displayName: "Ethereum",
    shortName: "Ethereum",
    rpcUrl: "https://ethereum.publicnode.com",
    isTestnet: false,
    stablecoins: {
      usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
  },
  {
    id: "arbitrum",
    caip2Id: "eip155:42161",
    displayName: "Arbitrum One",
    shortName: "Arbitrum",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    isTestnet: false,
    stablecoins: {
      usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      usdt: "0xFd086bC7CD5C481DCC9EC4eb50fF96488b4766Ae",
    },
  },
  {
    id: "optimism",
    caip2Id: "eip155:10",
    displayName: "Optimism",
    shortName: "Optimism",
    rpcUrl: "https://mainnet.optimism.io",
    isTestnet: false,
    stablecoins: {
      usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      usdt: "0x94b008aA00563869d9A0c8D4C5b327f130FcBd832",
    },
  },
  {
    id: "base-sepolia",
    caip2Id: "eip155:84532",
    displayName: "Base Sepolia",
    shortName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    isTestnet: true,
    stablecoins: {
      usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    },
  },
  {
    id: "sepolia",
    caip2Id: "eip155:11155111",
    displayName: "Ethereum Sepolia",
    shortName: "Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    isTestnet: true,
    stablecoins: {
      usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    },
  },
  {
    id: "arbitrum-sepolia",
    caip2Id: "eip155:421614",
    displayName: "Arbitrum Sepolia",
    shortName: "Arb Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    isTestnet: true,
    stablecoins: {
      usdc: "0x75faf114eafb1BDbe2F5b6aB59B5a9fc65cAe626",
    },
  },
  {
    id: "optimism-sepolia",
    caip2Id: "eip155:11155420",
    displayName: "Optimism Sepolia",
    shortName: "OP Sepolia",
    rpcUrl: "https://sepolia.optimism.io",
    isTestnet: true,
    stablecoins: {
      usdc: "0x5fd84259d066Cb710f212f7dE9b369A86B3f7E6F",
    },
  },
] as const;

export function getEvmChainByCaip2Id(
  caip2Id: string,
): EvmChainConfig | undefined {
  return EVM_CHAINS.find((chain) => chain.caip2Id === caip2Id);
}

/** Chains for the add-chain dialog; omit `isTestnet` to list every preset. */
export function getEvmChainPresets(isTestnet?: boolean): EvmChainConfig[] {
  if (isTestnet === undefined) {
    return [...EVM_CHAINS];
  }
  return EVM_CHAINS.filter((chain) => chain.isTestnet === isTestnet);
}

export function getEvmStablecoinsForChain(
  caip2Id: string,
): EvmStablecoinAddresses {
  return getEvmChainByCaip2Id(caip2Id)?.stablecoins ?? {};
}

/** Default ERC-20 for budgets / chain default asset (USDC when known). */
export function getDefaultStablecoinForChain(caip2Id: string): string | null {
  const stablecoins = getEvmStablecoinsForChain(caip2Id);
  return stablecoins.usdc ?? stablecoins.usdt ?? null;
}
