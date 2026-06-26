import {
  getDefaultStablecoinForChain,
  getEvmStablecoinsForChain,
} from "@/lib/x402/evm-config";

export type EvmTokenPreset = {
  id: "default" | "usdc" | "usdt";
  label: string;
  address: string;
};

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

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

  const known = getEvmStablecoinsForChain(caip2Id);
  if (known.usdc) {
    pushPreset(presets, seen, {
      id: "usdc",
      label: "USDC",
      address: known.usdc,
    });
  }
  if (known.usdt) {
    pushPreset(presets, seen, {
      id: "usdt",
      label: "USDT",
      address: known.usdt,
    });
  }

  return presets;
}

export { getDefaultStablecoinForChain };
