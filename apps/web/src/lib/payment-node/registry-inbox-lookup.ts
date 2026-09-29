import type { PaymentNodeNetwork, RegistryInboxEntry } from "./schemas";

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

type ListRegistryInbox = (params: {
  network: PaymentNodeNetwork;
  cursorId?: string;
  limit?: number;
  filterSmartContractAddress?: string | null;
}) => Promise<{ Assets: RegistryInboxEntry[] }>;

/**
 * Finds one inbox registry entry by id by paging the inbox list.
 * The payment node defaults unfiltered inbox lists to Web3CardanoV1, so V2
 * entries are only visible when `filterSmartContractAddress` is supplied.
 * A scoped miss falls back to the unfiltered (V1) list.
 */
export async function findRegistryInboxById(
  listRegistryInbox: ListRegistryInbox,
  params: {
    id: string;
    network: PaymentNodeNetwork;
    filterSmartContractAddress?: string | null;
  },
): Promise<RegistryInboxEntry | null> {
  const scan = async (
    filterSmartContractAddress?: string | null,
  ): Promise<RegistryInboxEntry | null> => {
    let cursorId: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { Assets } = await listRegistryInbox({
        network: params.network,
        cursorId,
        limit: PAGE_LIMIT,
        filterSmartContractAddress,
      });
      const match = Assets.find((asset) => asset.id === params.id);
      if (match) return match;
      if (Assets.length === 0) return null;
      const nextCursor = Assets[Assets.length - 1]!.id;
      if (nextCursor === cursorId) return null;
      cursorId = nextCursor;
    }
    return null;
  };

  const scoped = await scan(params.filterSmartContractAddress);
  if (scoped || !params.filterSmartContractAddress) return scoped;
  return scan(undefined);
}
