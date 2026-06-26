export type EvmTokenPreset = {
  id: "default" | "usdc" | "usdt";
  label: string;
  address: string;
};

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/** Well-known ERC-20 addresses for common x402 chains (budgets must match payment tokens). */
const KNOWN_TOKENS: Record<string, { usdc?: string; usdt?: string }> = {
  "eip155:8453": {
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdt: "0xfde4C96c8593536E31F229EA8f367978e6E846242",
  },
  "eip155:84532": {
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  "eip155:1": {
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D8317867",
  },
  "eip155:11155111": {
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  "eip155:42161": {
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdt: "0xFd086bC7CD5C481DCC9EC4eb50fF96488b4766aE",
  },
  "eip155:10": {
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    usdt: "0x94b008aA00563869d9A0c8D4C5b327f130FcBd832",
  },
};

function pushPreset(
  presets: EvmTokenPreset[],
  seen: Set<string>,
  preset: EvmTokenPreset,
) {
  const key = preset.address.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  presets.push(preset);
}

export function getEvmTokenPresetsForChain(
  caip2Id: string,
  defaultAsset?: string | null,
): EvmTokenPreset[] {
  const presets: EvmTokenPreset[] = [];
  const seen = new Set<string>();

  if (defaultAsset && EVM_ADDRESS.test(defaultAsset)) {
    pushPreset(presets, seen, {
      id: "default",
      label: "Chain default",
      address: defaultAsset,
    });
  }

  const known = KNOWN_TOKENS[caip2Id];
  if (known?.usdc) {
    pushPreset(presets, seen, {
      id: "usdc",
      label: "USDC",
      address: known.usdc,
    });
  }
  if (known?.usdt) {
    pushPreset(presets, seen, {
      id: "usdt",
      label: "USDT",
      address: known.usdt,
    });
  }

  return presets;
}
