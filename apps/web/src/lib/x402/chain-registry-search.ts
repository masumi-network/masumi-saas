import type { ChainRegistryEntry } from "./chain-registry-types";

const TESTNET_NAME_PATTERN =
  /\b(sepolia|goerli|holesky|testnet|amoy|fuji|mumbai|chapel|alfajores|moonbase|devnet|rinkeby|kovan|arb[- ]?sep|op[- ]?sep|base[- ]?sep)\b/i;

export function toCaip2Id(chainId: number): string {
  return `eip155:${chainId}`;
}

export function inferIsTestnetFromName(
  name: string,
  shortName?: string,
): boolean {
  return (
    TESTNET_NAME_PATTERN.test(name) ||
    TESTNET_NAME_PATTERN.test(shortName ?? "")
  );
}

export function normalizeChainSearchQuery(query: string): {
  text: string;
  chainId: number | null;
} {
  const trimmed = query.trim().toLowerCase();
  const caipMatch = /^eip155:(\d+)$/.exec(trimmed);
  if (caipMatch) {
    return { text: trimmed, chainId: Number(caipMatch[1]) };
  }
  if (/^\d+$/.test(trimmed)) {
    return { text: trimmed, chainId: Number(trimmed) };
  }
  return { text: trimmed, chainId: null };
}

function tokenizeChainLabel(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function matchesChainLabel(value: string, query: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized === query || normalized.startsWith(query)) {
    return true;
  }
  return tokenizeChainLabel(value).some(
    (token) => token === query || token.startsWith(query),
  );
}

function scoreChainMatch(
  entry: ChainRegistryEntry,
  query: ReturnType<typeof normalizeChainSearchQuery>,
): number {
  if (query.chainId != null) {
    if (entry.chainId === query.chainId) return 100;
    return 0;
  }

  if (!query.text) return 0;

  const name = entry.name.toLowerCase();
  const shortName = entry.shortName.toLowerCase();
  const caip2 = entry.caip2Id.toLowerCase();

  if (name === query.text || shortName === query.text || caip2 === query.text) {
    return 90;
  }
  if (name.startsWith(query.text) || shortName.startsWith(query.text)) {
    return 70;
  }
  if (
    matchesChainLabel(entry.name, query.text) ||
    matchesChainLabel(entry.shortName, query.text)
  ) {
    return 50;
  }
  if (caip2.includes(query.text)) {
    return 40;
  }
  if (String(entry.chainId).includes(query.text)) {
    return 30;
  }
  return 0;
}

export function searchChainRegistry(
  entries: readonly ChainRegistryEntry[],
  query: string,
  options?: {
    testnet?: boolean;
    limit?: number;
  },
): ChainRegistryEntry[] {
  const normalized = normalizeChainSearchQuery(query);
  const limit = options?.limit ?? 12;
  const environmentFilter = options?.testnet;

  const scored = entries
    .filter((entry) => {
      if (environmentFilter === undefined) return true;
      return entry.isTestnet === environmentFilter;
    })
    .map((entry) => {
      const baseScore = scoreChainMatch(entry, normalized);
      return {
        entry,
        score: baseScore > 0 ? baseScore + (entry.isCurated ? 5 : 0) : 0,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.entry.isCurated !== b.entry.isCurated) {
        return a.entry.isCurated ? -1 : 1;
      }
      return a.entry.name.localeCompare(b.entry.name);
    })
    .slice(0, limit)
    .map((item) => item.entry);

  return scored;
}

export function pickPreferredRpcUrl(rpcs: unknown): string | null {
  if (!Array.isArray(rpcs)) return null;

  type RpcCandidate = { url: string; tracking?: string };

  const candidates = rpcs.flatMap((entry): RpcCandidate[] => {
    if (typeof entry === "string") {
      return [{ url: entry }];
    }
    if (
      entry &&
      typeof entry === "object" &&
      "url" in entry &&
      typeof entry.url === "string"
    ) {
      return [
        {
          url: entry.url,
          tracking:
            "tracking" in entry && typeof entry.tracking === "string"
              ? entry.tracking
              : undefined,
        },
      ];
    }
    return [];
  });

  const httpsUrls = candidates.filter((candidate) =>
    candidate.url.startsWith("https://"),
  );
  const untracked = httpsUrls.filter(
    (candidate) => candidate.tracking === "none",
  );
  const limited = httpsUrls.filter(
    (candidate) => candidate.tracking === "limited",
  );

  // Only ever suggest https RPC endpoints. A cleartext http:// RPC on a signing/
  // facilitator path is a downgrade (MITM), so return null rather than fall back to one.
  return untracked[0]?.url ?? limited[0]?.url ?? httpsUrls[0]?.url ?? null;
}
