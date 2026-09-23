import "server-only";

import { EVM_CHAINS } from "@/lib/x402/evm-config";

import {
  inferIsTestnetFromName,
  pickPreferredRpcUrl,
  searchChainRegistry,
  toCaip2Id,
} from "./chain-registry-search";
import type { ChainRegistryEntry } from "./chain-registry-types";

const CHAINLIST_URL = "https://chainlist.org/rpcs.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type ChainlistEntry = {
  name?: string;
  shortName?: string;
  chainId?: number;
  testnet?: boolean;
  icon?: string;
  rpc?: unknown;
};

type RegistryCache = {
  loadedAt: number;
  entries: ChainRegistryEntry[];
};

const registryCache: { current: RegistryCache | null } = { current: null };

function inferIsTestnet(entry: ChainlistEntry): boolean {
  if (entry.testnet === true) return true;
  if (entry.testnet === false) return false;
  return inferIsTestnetFromName(entry.name ?? "", entry.shortName);
}

function mergeRegistryEntry(
  existing: ChainRegistryEntry | undefined,
  next: ChainRegistryEntry,
): ChainRegistryEntry {
  if (!existing) return next;
  return {
    ...existing,
    ...next,
    rpcUrl: next.rpcUrl ?? existing.rpcUrl,
    icon: next.icon ?? existing.icon,
    isCurated: existing.isCurated || next.isCurated,
  };
}

function buildRegistryFromChainlist(
  data: ChainlistEntry[],
): ChainRegistryEntry[] {
  const byChainId = new Map<number, ChainRegistryEntry>();

  for (const raw of data) {
    if (typeof raw.chainId !== "number" || !Number.isFinite(raw.chainId)) {
      continue;
    }

    const chainId = raw.chainId;
    const entry: ChainRegistryEntry = {
      chainId,
      caip2Id: toCaip2Id(chainId),
      name: raw.name?.trim() || `Chain ${chainId}`,
      shortName: raw.shortName?.trim() || String(chainId),
      isTestnet: inferIsTestnet(raw),
      rpcUrl: pickPreferredRpcUrl(raw.rpc),
      icon:
        typeof raw.icon === "string" && raw.icon.trim()
          ? raw.icon.trim().toLowerCase()
          : null,
    };

    byChainId.set(chainId, mergeRegistryEntry(byChainId.get(chainId), entry));
  }

  for (const preset of EVM_CHAINS) {
    const chainId = Number(preset.caip2Id.split(":")[1]);
    byChainId.set(
      chainId,
      mergeRegistryEntry(byChainId.get(chainId), {
        chainId,
        caip2Id: preset.caip2Id,
        name: preset.displayName,
        shortName: preset.shortName,
        isTestnet: preset.isTestnet,
        rpcUrl: preset.rpcUrl,
        icon: preset.icon,
        isCurated: true,
      }),
    );
  }

  return [...byChainId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function loadChainRegistry(): Promise<ChainRegistryEntry[]> {
  const cached = registryCache.current;
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.entries;
  }

  const response = await fetch(CHAINLIST_URL, {
    next: { revalidate: 86_400 },
  });
  if (!response.ok) {
    throw new Error(`Failed to load chain registry (${response.status})`);
  }

  const data = (await response.json()) as ChainlistEntry[];
  const entries = buildRegistryFromChainlist(data);
  registryCache.current = { loadedAt: Date.now(), entries };
  return entries;
}

export async function searchChainsForX402(input: {
  q: string;
  testnet?: boolean;
  limit?: number;
}): Promise<ChainRegistryEntry[]> {
  const entries = await loadChainRegistry();
  return searchChainRegistry(entries, input.q, {
    testnet: input.testnet,
    limit: input.limit,
  });
}

export async function resolveChainsByCaip2Ids(
  caip2Ids: string[],
): Promise<ChainRegistryEntry[]> {
  const uniqueIds = [
    ...new Set(caip2Ids.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) return [];

  const entries = await loadChainRegistry();
  const byCaip2Id = new Map(entries.map((entry) => [entry.caip2Id, entry]));

  return uniqueIds
    .map((caip2Id) => byCaip2Id.get(caip2Id))
    .filter((entry): entry is ChainRegistryEntry => entry != null);
}
