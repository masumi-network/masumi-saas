export type CardanoNetwork = "Mainnet" | "Preprod";

export const CARDANO_MAINNET_CAIP2 = "cardano:mainnet";
export const CARDANO_PREPROD_CAIP2 = "cardano:preprod";
export const BASE_MAINNET_CAIP2 = "eip155:8453";
export const BASE_SEPOLIA_CAIP2 = "eip155:84532";

export const DEFAULT_ADMIN_CAIP2_NETWORK_LIMIT = [
  CARDANO_MAINNET_CAIP2,
  CARDANO_PREPROD_CAIP2,
  BASE_MAINNET_CAIP2,
  BASE_SEPOLIA_CAIP2,
] as const;

export function cardanoNetworkToCaip2(network: CardanoNetwork): string {
  switch (network) {
    case "Mainnet":
      return CARDANO_MAINNET_CAIP2;
    case "Preprod":
      return CARDANO_PREPROD_CAIP2;
    default:
      throw new Error("Invalid network");
  }
}

export function caip2ToCardanoNetwork(chainId: string): CardanoNetwork | null {
  switch (chainId) {
    case CARDANO_MAINNET_CAIP2:
    case "Mainnet":
      return "Mainnet";
    case CARDANO_PREPROD_CAIP2:
    case "Preprod":
      return "Preprod";
    default:
      return null;
  }
}

export function cardanoNetworksToCaip2(networks: CardanoNetwork[]): string[] {
  return Array.from(new Set(networks.map(cardanoNetworkToCaip2)));
}

export function caip2LimitToCardanoNetworks(
  chainIds: string[],
): CardanoNetwork[] {
  const result: CardanoNetwork[] = [];
  for (const chainId of chainIds) {
    const network = caip2ToCardanoNetwork(chainId);
    if (network != null && !result.includes(network)) {
      result.push(network);
    }
  }
  return result;
}

export function mergeCaip2NetworkLimits(
  cardanoNetworks: CardanoNetwork[],
  caip2Networks: string[] = [],
): string[] {
  return Array.from(
    new Set([...cardanoNetworksToCaip2(cardanoNetworks), ...caip2Networks]),
  );
}

export function isAllowedCaip2Network(
  networkLimit: string[] | null | undefined,
  caip2Network: string,
): boolean {
  if (networkLimit == null) {
    return true;
  }
  return networkLimit.includes(caip2Network);
}
