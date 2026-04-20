import "server-only";

import type { InboxAgentReference, Prisma } from "@masumi/database";
import prisma, { type RegistrationState } from "@masumi/database/client";

import type {
  PaymentNodeClient,
  PaymentNodeNetwork,
  PaymentSourceInfo,
  PaymentSourceWallet,
  RegistryInboxEntry,
  RegistryStatusFilter,
} from "@/lib/payment-node";
import { createPaymentNodeClient, paymentNodeConfig } from "@/lib/payment-node";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import { registryInboxEntrySchema } from "@/lib/payment-node/schemas";

import { isWalletAddressCompatibleWithNetwork } from "../payment-node/registration-wallets";

const PAYMENT_SOURCE_PAGE_SIZE = 100;
const MAX_PAYMENT_SOURCE_PAGES = 10;
const REFRESH_CONCURRENCY = 5;

const PENDING_STATES: RegistrationState[] = [
  "RegistrationRequested",
  "RegistrationInitiated",
  "DeregistrationRequested",
  "DeregistrationInitiated",
];

const FILTER_STATUS_STATES: Record<RegistryStatusFilter, RegistrationState[]> =
  {
    Registered: ["RegistrationConfirmed"],
    Deregistered: ["DeregistrationConfirmed"],
    Pending: PENDING_STATES,
    Failed: ["RegistrationFailed", "DeregistrationFailed"],
  };

type ManagedInboxRegistrationResult =
  | {
      success: true;
      executingWallet: PaymentSourceWallet;
      paymentSourceId: string;
      smartContractAddress: string;
    }
  | {
      success: false;
      error: string;
    };

type InboxAgentReferenceWriteParams = {
  userId: string;
  network: PaymentNodeNetwork;
  entry: RegistryInboxEntry;
  executingWallet: Pick<
    PaymentSourceWallet,
    "id" | "walletVkey" | "walletAddress"
  >;
  smartContractAddress?: string | null;
};

export class InboxAgentOwnershipMismatchError extends Error {
  readonly ownedByUserId: string;

  constructor(ownedByUserId: string) {
    super("Inbox agent is owned by a different user");
    this.name = "InboxAgentOwnershipMismatchError";
    this.ownedByUserId = ownedByUserId;
  }
}

export function isInboxAgentOwnershipMismatchError(
  error: unknown,
): error is InboxAgentOwnershipMismatchError {
  return error instanceof InboxAgentOwnershipMismatchError;
}

export class StaleInboxAgentCursorError extends Error {
  readonly cursor: string;

  constructor(cursor: string) {
    super(
      "This page of inbox agents is out of date. Refresh to load the latest items.",
    );
    this.name = "StaleInboxAgentCursorError";
    this.cursor = cursor;
  }
}

export function isStaleInboxAgentCursorError(
  error: unknown,
): error is StaleInboxAgentCursorError {
  return error instanceof StaleInboxAgentCursorError;
}

export type ListOwnedInboxAgentsResult = {
  Assets: RegistryInboxEntry[];
  nextCursor: string | null;
};

export type OwnedInboxAgent = {
  source: "db";
  reference: InboxAgentReference;
  entry: RegistryInboxEntry;
  executingWallet: Pick<
    PaymentSourceWallet,
    "id" | "walletVkey" | "walletAddress"
  >;
  smartContractAddress: string | null;
};

export function createInboxAdminPaymentNodeClient(): PaymentNodeClient {
  return createPaymentNodeClient(
    paymentNodeConfig.getBaseUrl(),
    paymentNodeConfig.getAdminApiKey(),
  );
}

function tryCreateInboxAdminPaymentNodeClient(): PaymentNodeClient | null {
  try {
    return createInboxAdminPaymentNodeClient();
  } catch (error) {
    if (isPaymentNodeConfigError(error)) return null;
    throw error;
  }
}

async function listPaymentSources(
  client: PaymentNodeClient,
): Promise<PaymentSourceInfo[]> {
  const sources: PaymentSourceInfo[] = [];
  let cursorId: string | undefined;

  for (let page = 0; page < MAX_PAYMENT_SOURCE_PAGES; page += 1) {
    const result = await client.getPaymentSources({
      take: PAYMENT_SOURCE_PAGE_SIZE,
      cursorId,
    });
    sources.push(...result.PaymentSources);

    if (result.PaymentSources.length < PAYMENT_SOURCE_PAGE_SIZE) {
      break;
    }

    const nextCursor = result.PaymentSources.at(-1)?.id;
    if (!nextCursor || nextCursor === cursorId) {
      break;
    }
    cursorId = nextCursor;
  }

  return sources;
}

export async function listPaymentSourcesForNetwork(
  client: PaymentNodeClient,
  network: PaymentNodeNetwork,
): Promise<PaymentSourceInfo[]> {
  const sources = await listPaymentSources(client);
  return sources.filter((source) => source.network === network);
}

function findPaymentSourceBySellingWallet(
  paymentSources: PaymentSourceInfo[],
  sellingWalletVkey: string,
): PaymentSourceInfo | null {
  return (
    paymentSources.find((paymentSource) =>
      paymentSource.SellingWallets.some(
        (wallet: PaymentSourceInfo["SellingWallets"][number]) =>
          wallet.walletVkey === sellingWalletVkey,
      ),
    ) ?? null
  );
}

function getPaymentSourceMismatchError(params: {
  paymentSourceId: string;
  expectedNetwork: PaymentNodeNetwork;
  actualNetwork: PaymentNodeNetwork;
}) {
  return `Configured payment source ${params.paymentSourceId} is on ${params.actualNetwork}, but inbox-agent registration is using ${params.expectedNetwork}. Update ${paymentNodeConfig.getPaymentSourceIdEnvName(params.expectedNetwork)} to a ${params.expectedNetwork} payment source.`;
}

export async function prepareManagedInboxRegistration(params: {
  name: string;
  network: PaymentNodeNetwork;
}): Promise<ManagedInboxRegistrationResult> {
  let adminClient: PaymentNodeClient;
  let paymentSourceId: string;
  const paymentSourceEnvName = paymentNodeConfig.getPaymentSourceIdEnvName(
    params.network,
  );
  try {
    adminClient = createInboxAdminPaymentNodeClient();
    paymentSourceId = paymentNodeConfig.getPaymentSourceId(params.network);
  } catch (error) {
    if (
      isPaymentNodeConfigError(error) &&
      error.envName === paymentSourceEnvName
    ) {
      throw error;
    }
    console.error("Payment node config missing for inbox registration:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again later.",
    };
  }

  const paymentSources = await listPaymentSources(adminClient);
  const paymentSource =
    paymentSources.find((source) => source.id === paymentSourceId) ?? null;

  if (!paymentSource) {
    return {
      success: false,
      error: `Configured payment source ${paymentSourceId} could not be found for inbox-agent registration.`,
    };
  }

  if (paymentSource.network && paymentSource.network !== params.network) {
    console.error("[Payment Node] Payment source network mismatch:", {
      paymentSourceId,
      expectedNetwork: params.network,
      actualNetwork: paymentSource.network,
    });
    return {
      success: false,
      error: getPaymentSourceMismatchError({
        paymentSourceId,
        expectedNetwork: params.network,
        actualNetwork: paymentSource.network,
      }),
    };
  }

  const generatedWallet = await adminClient.generateWallet(params.network);
  if (
    !isWalletAddressCompatibleWithNetwork(
      generatedWallet.walletAddress,
      params.network,
    )
  ) {
    console.error("[Payment Node] Generated inbox wallet network mismatch:", {
      walletAddress: generatedWallet.walletAddress,
      expectedNetwork: params.network,
    });
    return {
      success: false,
      error: `Generated inbox wallet address does not match ${params.network}. Please verify the payment node wallet configuration and try again.`,
    };
  }

  const updatedPaymentSource = await adminClient.addWalletsToPaymentSource({
    paymentSourceId,
    AddSellingWallets: [
      {
        walletMnemonic: generatedWallet.walletMnemonic,
        note: `Inbox agent: ${params.name} (selling)`,
        collectionAddress: null,
      },
    ],
  });
  const executingWallet =
    updatedPaymentSource.SellingWallets.find(
      (wallet) => wallet.walletVkey === generatedWallet.walletVkey,
    ) ?? null;
  if (!executingWallet) {
    console.error("[Payment Node] Could not resolve managed inbox wallet ID:", {
      walletVkey: generatedWallet.walletVkey,
      paymentSourceId,
    });
    return {
      success: false,
      error:
        "Could not attach the new inbox wallet to payment permissions. Please try again.",
    };
  }

  return {
    success: true,
    executingWallet,
    paymentSourceId,
    smartContractAddress:
      updatedPaymentSource.smartContractAddress ??
      paymentSource.smartContractAddress,
  };
}

function toRegistryEntryJson(entry: RegistryInboxEntry) {
  return entry as unknown as Record<string, unknown>;
}

function parseStoredRegistryEntry(value: unknown): RegistryInboxEntry | null {
  const result = registryInboxEntrySchema.safeParse(value);
  return result.success ? result.data : null;
}

function referenceToRegistryInboxEntry(
  reference: InboxAgentReference,
): RegistryInboxEntry {
  const stored = parseStoredRegistryEntry(reference.registryEntry);
  if (stored) {
    return {
      ...stored,
      name: reference.name,
      description: reference.description,
      agentSlug: reference.agentSlug,
      state: reference.state,
      agentIdentifier: reference.agentIdentifier,
    };
  }

  return {
    error: null,
    id: reference.paymentNodeId,
    name: reference.name,
    description: reference.description,
    agentSlug: reference.agentSlug,
    state: reference.state,
    createdAt: reference.createdAt.toISOString(),
    updatedAt: reference.updatedAt.toISOString(),
    lastCheckedAt: null,
    agentIdentifier: reference.agentIdentifier,
    metadataVersion: 1,
    sendFundingLovelace: null,
    SmartContractWallet: {
      walletVkey: reference.executingWalletVkey,
      walletAddress: reference.executingWalletAddress,
    },
    RecipientWallet: {
      walletVkey: reference.executingWalletVkey,
      walletAddress: reference.executingWalletAddress,
    },
    CurrentTransaction: null,
  };
}

function getReferenceWriteData(params: InboxAgentReferenceWriteParams) {
  return {
    userId: params.userId,
    paymentNodeId: params.entry.id,
    networkIdentifier: params.network,
    name: params.entry.name,
    description: params.entry.description,
    agentSlug: params.entry.agentSlug,
    state: params.entry.state as RegistrationState,
    agentIdentifier: params.entry.agentIdentifier,
    executingWalletId: params.executingWallet.id,
    executingWalletVkey: params.executingWallet.walletVkey,
    executingWalletAddress: params.executingWallet.walletAddress,
    smartContractAddress: params.smartContractAddress ?? null,
    registryEntry: toRegistryEntryJson(params.entry),
  };
}

export async function saveInboxAgentReference(
  params: InboxAgentReferenceWriteParams,
): Promise<InboxAgentReference> {
  const data = getReferenceWriteData(params);
  const where = {
    networkIdentifier_paymentNodeId: {
      networkIdentifier: params.network,
      paymentNodeId: params.entry.id,
    },
  };

  const existing = await prisma.inboxAgentReference.findUnique({ where });
  if (existing) {
    if (existing.userId !== params.userId) {
      throw new InboxAgentOwnershipMismatchError(existing.userId);
    }
    return prisma.inboxAgentReference.update({
      where: { id: existing.id },
      data,
    });
  }

  try {
    return await prisma.inboxAgentReference.create({ data });
  } catch (error) {
    if (
      typeof error === "object" &&
      error != null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const createdByConcurrentRequest =
        await prisma.inboxAgentReference.findUnique({ where });
      if (createdByConcurrentRequest) {
        if (createdByConcurrentRequest.userId !== params.userId) {
          throw new InboxAgentOwnershipMismatchError(
            createdByConcurrentRequest.userId,
          );
        }
        return prisma.inboxAgentReference.update({
          where: { id: createdByConcurrentRequest.id },
          data,
        });
      }
    }
    throw error;
  }
}

function getFilterStates(
  filterStatus?: RegistryStatusFilter,
): RegistrationState[] | undefined {
  return filterStatus ? FILTER_STATUS_STATES[filterStatus] : undefined;
}

function matchesFilterStatus(
  entry: RegistryInboxEntry,
  filterStatus?: RegistryStatusFilter,
): boolean {
  const states = getFilterStates(filterStatus);
  return !states || states.includes(entry.state as RegistrationState);
}

function matchesSearch(entry: RegistryInboxEntry, search?: string) {
  const query = search?.trim().toLowerCase();
  if (!query) return true;

  return (
    entry.name.toLowerCase().includes(query) ||
    entry.description?.toLowerCase().includes(query) === true ||
    entry.agentSlug.toLowerCase().includes(query) ||
    entry.agentIdentifier?.toLowerCase().includes(query) === true
  );
}

function getExecutingWalletFromReference(
  reference: InboxAgentReference,
): Pick<PaymentSourceWallet, "id" | "walletVkey" | "walletAddress"> {
  return {
    id: reference.executingWalletId,
    walletVkey: reference.executingWalletVkey,
    walletAddress: reference.executingWalletAddress,
  };
}

function sortInboxEntriesByCreatedAtDesc(
  entries: RegistryInboxEntry[],
): RegistryInboxEntry[] {
  return entries.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

function isPendingRegistrationState(state: RegistrationState): boolean {
  return PENDING_STATES.includes(state);
}

function getSearchFilter(
  search?: string,
): Prisma.InboxAgentReferenceWhereInput | null {
  const query = search?.trim();
  if (!query) return null;

  return {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { agentSlug: { contains: query, mode: "insensitive" } },
      { agentIdentifier: { contains: query, mode: "insensitive" } },
    ],
  };
}

function getCursorWindowFilter(
  cursorReference: InboxAgentReference | null,
): Prisma.InboxAgentReferenceWhereInput | null {
  if (!cursorReference) return null;

  return {
    OR: [
      { createdAt: { lt: cursorReference.createdAt } },
      {
        createdAt: cursorReference.createdAt,
        id: { lt: cursorReference.id },
      },
    ],
  };
}

function getListReferenceWhere(params: {
  userId: string;
  network: PaymentNodeNetwork;
  filterStatus?: RegistryStatusFilter;
  search?: string;
  cursorReference?: InboxAgentReference | null;
}): Prisma.InboxAgentReferenceWhereInput {
  const andFilters = [
    params.filterStatus
      ? { state: { in: getFilterStates(params.filterStatus) ?? [] } }
      : null,
    getSearchFilter(params.search),
    getCursorWindowFilter(params.cursorReference ?? null),
  ].filter(
    (filter): filter is Prisma.InboxAgentReferenceWhereInput => filter != null,
  );

  return {
    userId: params.userId,
    networkIdentifier: params.network,
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function refreshInboxAgentReference(params: {
  userId: string;
  network: PaymentNodeNetwork;
  reference: InboxAgentReference;
  client?: PaymentNodeClient | null;
}): Promise<RegistryInboxEntry> {
  const fallbackEntry = referenceToRegistryInboxEntry(params.reference);

  if (!isPendingRegistrationState(params.reference.state)) {
    return fallbackEntry;
  }

  if (!params.client) {
    return fallbackEntry;
  }

  try {
    const remote = await params.client.getRegistryInboxById({
      id: params.reference.paymentNodeId,
      network: params.network,
    });

    if (!remote) {
      return fallbackEntry;
    }

    const updated = await saveInboxAgentReference({
      userId: params.userId,
      network: params.network,
      entry: remote,
      executingWallet: getExecutingWalletFromReference(params.reference),
      smartContractAddress: params.reference.smartContractAddress,
    });

    return referenceToRegistryInboxEntry(updated);
  } catch (error) {
    console.warn(
      "[Inbox Agents] Failed to refresh inbox agent reference; using local data.",
      {
        error,
        network: params.network,
        paymentNodeId: params.reference.paymentNodeId,
        referenceId: params.reference.id,
      },
    );
    return fallbackEntry;
  }
}

export async function listOwnedInboxAgentsForUser(params: {
  userId: string;
  network: PaymentNodeNetwork;
  take: number;
  cursor?: string;
  filterStatus?: RegistryStatusFilter;
  search?: string;
}): Promise<ListOwnedInboxAgentsResult> {
  let lookupClient: PaymentNodeClient | null | undefined;
  const getLookupClient = () => {
    if (lookupClient === undefined) {
      lookupClient = tryCreateInboxAdminPaymentNodeClient();
    }
    return lookupClient;
  };

  const cursorReference = params.cursor
    ? await prisma.inboxAgentReference.findFirst({
        where: {
          userId: params.userId,
          networkIdentifier: params.network,
          paymentNodeId: params.cursor,
        },
      })
    : null;

  if (params.cursor && !cursorReference) {
    throw new StaleInboxAgentCursorError(params.cursor);
  }

  if (cursorReference) {
    const cursorEntry = await refreshInboxAgentReference({
      userId: params.userId,
      network: params.network,
      reference: cursorReference,
      client: isPendingRegistrationState(cursorReference.state)
        ? getLookupClient()
        : null,
    });
    if (
      !matchesSearch(cursorEntry, params.search) ||
      !matchesFilterStatus(cursorEntry, params.filterStatus)
    ) {
      throw new StaleInboxAgentCursorError(params.cursor!);
    }
  }

  const references = await prisma.inboxAgentReference.findMany({
    where: getListReferenceWhere({
      userId: params.userId,
      network: params.network,
      filterStatus: params.filterStatus,
      search: params.search,
      cursorReference,
    }),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: params.take,
  });
  if (references.length === 0) {
    return { Assets: [], nextCursor: null };
  }

  const needsRefresh = references.some((reference) =>
    isPendingRegistrationState(reference.state),
  );
  const client = needsRefresh ? getLookupClient() : null;

  const refreshedDbAssets = await mapWithConcurrency(
    references,
    REFRESH_CONCURRENCY,
    (reference) =>
      refreshInboxAgentReference({
        userId: params.userId,
        network: params.network,
        reference,
        client,
      }),
  );

  const assetsById = new Map<string, RegistryInboxEntry>();
  for (const entry of refreshedDbAssets) assetsById.set(entry.id, entry);

  const Assets = sortInboxEntriesByCreatedAtDesc(
    Array.from(assetsById.values()),
  )
    .filter((entry) => matchesSearch(entry, params.search))
    .filter((entry) => matchesFilterStatus(entry, params.filterStatus))
    .slice(0, params.take);

  return {
    Assets,
    nextCursor:
      Assets.length === params.take ? (Assets.at(-1)?.id ?? null) : null,
  };
}

async function getOwnedInboxAgentFromReference(params: {
  userId: string;
  network: PaymentNodeNetwork;
  reference: InboxAgentReference;
  client: PaymentNodeClient | null;
}): Promise<OwnedInboxAgent | null> {
  const executingWallet = getExecutingWalletFromReference(params.reference);
  if (!params.client) {
    return {
      source: "db",
      reference: params.reference,
      entry: referenceToRegistryInboxEntry(params.reference),
      executingWallet,
      smartContractAddress: params.reference.smartContractAddress,
    };
  }

  const remote = await params.client.getRegistryInboxById({
    id: params.reference.paymentNodeId,
    network: params.network,
  });

  if (!remote) {
    return {
      source: "db",
      reference: params.reference,
      entry: referenceToRegistryInboxEntry(params.reference),
      executingWallet,
      smartContractAddress: params.reference.smartContractAddress,
    };
  }

  const updatedReference = await saveInboxAgentReference({
    userId: params.userId,
    network: params.network,
    entry: remote,
    executingWallet,
    smartContractAddress: params.reference.smartContractAddress,
  });

  return {
    source: "db",
    reference: updatedReference,
    entry: referenceToRegistryInboxEntry(updatedReference),
    executingWallet,
    smartContractAddress: updatedReference.smartContractAddress,
  };
}

export async function getOwnedInboxAgentForUser(params: {
  userId: string;
  network: PaymentNodeNetwork;
  inboxAgentId: string;
}): Promise<OwnedInboxAgent | null> {
  const reference = await getOwnedInboxAgentReference({
    userId: params.userId,
    network: params.network,
    inboxAgentId: params.inboxAgentId,
  });

  if (reference) {
    return getOwnedInboxAgentFromReference({
      userId: params.userId,
      network: params.network,
      reference,
      client: tryCreateInboxAdminPaymentNodeClient(),
    });
  }

  return null;
}

export async function getOwnedInboxAgentByAgentIdentifierForUser(params: {
  userId: string;
  network: PaymentNodeNetwork;
  agentIdentifier: string;
}): Promise<OwnedInboxAgent | null> {
  const reference = await getOwnedInboxAgentReferenceByAgentIdentifier({
    userId: params.userId,
    network: params.network,
    agentIdentifier: params.agentIdentifier,
  });

  if (reference) {
    const owned = await getOwnedInboxAgentFromReference({
      userId: params.userId,
      network: params.network,
      reference,
      client: tryCreateInboxAdminPaymentNodeClient(),
    });
    if (owned) return owned;
  }

  return null;
}

export async function getOwnedInboxAgentReference(params: {
  userId: string;
  network: PaymentNodeNetwork;
  inboxAgentId: string;
}): Promise<InboxAgentReference | null> {
  return prisma.inboxAgentReference.findFirst({
    where: {
      userId: params.userId,
      networkIdentifier: params.network,
      paymentNodeId: params.inboxAgentId,
    },
  });
}

export async function getOwnedInboxAgentReferenceByAgentIdentifier(params: {
  userId: string;
  network: PaymentNodeNetwork;
  agentIdentifier: string;
}): Promise<InboxAgentReference | null> {
  return prisma.inboxAgentReference.findFirst({
    where: {
      userId: params.userId,
      networkIdentifier: params.network,
      agentIdentifier: params.agentIdentifier,
    },
  });
}

export async function getRegisteredOwnedInboxAgentReferenceByAgentIdentifier(params: {
  userId: string;
  network: PaymentNodeNetwork;
  agentIdentifier: string;
}): Promise<InboxAgentReference | null> {
  return prisma.inboxAgentReference.findFirst({
    where: {
      userId: params.userId,
      networkIdentifier: params.network,
      agentIdentifier: params.agentIdentifier,
      state: "RegistrationConfirmed",
    },
  });
}

export async function deleteInboxAgentReference(id: string): Promise<void> {
  await prisma.inboxAgentReference.delete({
    where: { id },
  });
}

export async function resolveInboxSmartContractAddress(
  client: PaymentNodeClient,
  network: PaymentNodeNetwork,
  sellingWalletVkey: string,
): Promise<string | null> {
  const paymentSources = await listPaymentSourcesForNetwork(client, network);
  return (
    findPaymentSourceBySellingWallet(paymentSources, sellingWalletVkey)
      ?.smartContractAddress ?? null
  );
}
