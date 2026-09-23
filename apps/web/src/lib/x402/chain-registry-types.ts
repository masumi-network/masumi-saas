export type ChainRegistryEntry = {
  chainId: number;
  caip2Id: string;
  name: string;
  shortName: string;
  isTestnet: boolean;
  rpcUrl: string | null;
  icon: string | null;
  isCurated?: boolean;
};

export type ChainSearchResult = ChainRegistryEntry;
