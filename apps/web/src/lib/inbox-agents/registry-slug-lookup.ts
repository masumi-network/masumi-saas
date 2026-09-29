import type {
  PaymentNodeClient,
  PaymentNodeNetwork,
  RegistryInboxEntry,
} from "@/lib/payment-node";

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

/**
 * Finds the first registry inbox entry with this exact slug that `isActive`
 * accepts. The payment node defaults unfiltered inbox lists to
 * Web3CardanoV1, so each smart contract (V1 and V2) is scanned separately.
 * With no contract addresses, one unfiltered (V1) scan runs.
 */
export async function findActiveRegistryInboxBySlug(params: {
  client: Pick<PaymentNodeClient, "getRegistryInbox">;
  network: PaymentNodeNetwork;
  slug: string;
  smartContractAddresses: string[];
  isActive: (entry: RegistryInboxEntry) => boolean;
}): Promise<RegistryInboxEntry | null> {
  const contractFilters: (string | undefined)[] =
    params.smartContractAddresses.length > 0
      ? [...new Set(params.smartContractAddresses)]
      : [undefined];

  for (const filterSmartContractAddress of contractFilters) {
    let cursorId: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const { Assets } = await params.client.getRegistryInbox({
        network: params.network,
        cursorId,
        limit: PAGE_LIMIT,
        filterSmartContractAddress,
        searchQuery: params.slug,
      });

      const match = Assets.find(
        (asset) => asset.agentSlug === params.slug && params.isActive(asset),
      );
      if (match) return match;

      const nextCursor = Assets.at(-1)?.id;
      if (!nextCursor || nextCursor === cursorId) break;
      cursorId = nextCursor;
    }
  }

  return null;
}
