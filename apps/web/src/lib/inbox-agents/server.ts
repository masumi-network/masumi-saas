import "server-only";

import type { InboxAgentReference } from "@masumi/database";
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
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { registryInboxEntrySchema } from "@/lib/payment-node/schemas";

import {
  isWalletAddressCompatibleWithNetwork,
  resolveRegistrationFundingWallet,
} from "../payment-node/registration-wallets";

const PAYMENT_SOURCE_PAGE_SIZE = 100;
const MAX_PAYMENT_SOURCE_PAGES = 10;
// Legacy (pre-PR) inboxes are surfaced via a bounded scan of the registry,
// filtered to wallets scoped to the user's payment-node API key. Per-request
// legacy scanning is capped to avoid amplifying network load on every list
// call; users with more legacy entries than this should migrate.
const MAX_LEGACY_LOOKUP_PAGES = 5;
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
  source: "db" | "legacy-wallet";
  reference: InboxAgentReference | null;
  entry: RegistryInboxEntry;
  executingWallet: Pick<
    PaymentSourceWallet,
    "id" | "walletVkey" | "walletAddress"
  >;
  smartContractAddress: string | null;
  remoteMissing?: true;
};

type LegacyInboxOwnershipContext = {
  userClient: PaymentNodeClient;
  paymentSources: PaymentSourceInfo[];
  scopedWalletIds: Set<string>;
};

export function createInboxAdminPaymentNodeClient(): PaymentNodeClient {
  return createPaymentNodeClient(
    paymentNodeConfig.getBaseUrl(),
    paymentNodeConfig.getAdminApiKey(),
  );
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

  const executingWalletResult = resolveRegistrationFundingWallet({
    network: params.network,
    paymentSourceId,
    sellingWallets: paymentSource.SellingWallets,
  });
  if (!executingWalletResult.wallet) {
    return {
      success: false,
      error:
        executingWalletResult.error ??
        "No registration funding wallet is available for this payment source.",
    };
  }

  const executingWallet = executingWalletResult.wallet;
  if (
    !isWalletAddressCompatibleWithNetwork(
      executingWallet.walletAddress,
      params.network,
    )
  ) {
    console.error("[Payment Node] Executing inbox wallet network mismatch:", {
      walletAddress: executingWallet.walletAddress,
      expectedNetwork: params.network,
    });
    return {
      success: false,
      error: `Configured inbox executing wallet address does not match ${params.network}. Please verify the payment node wallet configuration and try again.`,
    };
  }

  return {
    success: true,
    executingWallet,
    paymentSourceId,
    smartContractAddress: paymentSource.smartContractAddress,
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

function findExecutingWalletForEntry(params: {
  entry: RegistryInboxEntry;
  paymentSources: PaymentSourceInfo[];
}): {
  wallet: Pick<PaymentSourceWallet, "id" | "walletVkey" | "walletAddress">;
  smartContractAddress: string | null;
} {
  const paymentSource = findPaymentSourceBySellingWallet(
    params.paymentSources,
    params.entry.SmartContractWallet.walletVkey,
  );
  const matchedWallet =
    paymentSource?.SellingWallets.find(
      (wallet) =>
        wallet.walletVkey === params.entry.SmartContractWallet.walletVkey,
    ) ?? null;

  return {
    wallet: matchedWallet
      ? {
          id: matchedWallet.id,
          walletVkey: matchedWallet.walletVkey,
          walletAddress: matchedWallet.walletAddress,
        }
      : {
          id: `legacy:${params.entry.SmartContractWallet.walletVkey}`,
          walletVkey: params.entry.SmartContractWallet.walletVkey,
          walletAddress: params.entry.SmartContractWallet.walletAddress,
        },
    smartContractAddress: paymentSource?.smartContractAddress ?? null,
  };
}

function findSellingWalletByVkey(params: {
  paymentSources: PaymentSourceInfo[];
  walletVkey: string;
}): PaymentSourceWallet | null {
  for (const paymentSource of params.paymentSources) {
    const wallet = paymentSource.SellingWallets.find(
      (candidate) => candidate.walletVkey === params.walletVkey,
    );
    if (wallet) return wallet;
  }
  return null;
}

async function createLegacyInboxOwnershipContext(params: {
  userId: string;
  network: PaymentNodeNetwork;
  adminClient: PaymentNodeClient;
}): Promise<LegacyInboxOwnershipContext | null> {
  const userClient = await getPaymentNodeClientForUser(params.userId);
  if (!userClient) return null;

  let scopedWalletIds: Set<string>;
  try {
    const keyStatus = await userClient.getApiKeyStatus();
    scopedWalletIds = new Set(
      keyStatus.WalletScopes.map((scope) => scope.hotWalletId),
    );
  } catch (error) {
    console.warn(
      "[Inbox Agents] Legacy inbox wallet lookup skipped; API key status unavailable:",
      error,
    );
    return null;
  }

  const paymentSources = await listPaymentSourcesForNetwork(
    params.adminClient,
    params.network,
  );

  return {
    userClient,
    paymentSources,
    scopedWalletIds,
  };
}

function isOwnedByScopedLegacyRecipientWallet(
  entry: RegistryInboxEntry,
  context: LegacyInboxOwnershipContext,
): boolean {
  if (!entry.RecipientWallet) return false;
  if (
    entry.RecipientWallet.walletVkey === entry.SmartContractWallet.walletVkey
  ) {
    return false;
  }

  const recipientWallet = findSellingWalletByVkey({
    paymentSources: context.paymentSources,
    walletVkey: entry.RecipientWallet.walletVkey,
  });

  return recipientWallet
    ? context.scopedWalletIds.has(recipientWallet.id)
    : false;
}

async function listLegacyOwnedInboxEntries(params: {
  userId: string;
  network: PaymentNodeNetwork;
  adminClient: PaymentNodeClient;
}): Promise<{
  entries: RegistryInboxEntry[];
  paymentSources: PaymentSourceInfo[];
}> {
  const context = await createLegacyInboxOwnershipContext(params);
  if (!context) {
    return { entries: [], paymentSources: [] };
  }

  if (context.scopedWalletIds.size === 0) {
    return { entries: [], paymentSources: context.paymentSources };
  }

  const entries: RegistryInboxEntry[] = [];
  let cursorId: string | undefined;

  for (let page = 0; page < MAX_LEGACY_LOOKUP_PAGES; page += 1) {
    let response: { Assets: RegistryInboxEntry[] };
    try {
      response = await context.userClient.getRegistryInbox({
        network: params.network,
        cursorId,
        limit: PAYMENT_SOURCE_PAGE_SIZE,
      });
    } catch (error) {
      console.warn("[Inbox Agents] Legacy inbox wallet lookup skipped:", error);
      return { entries, paymentSources: context.paymentSources };
    }

    for (const entry of response.Assets) {
      if (isOwnedByScopedLegacyRecipientWallet(entry, context)) {
        entries.push(entry);
      }
    }

    if (response.Assets.length < PAYMENT_SOURCE_PAGE_SIZE) {
      break;
    }
    const nextCursor = response.Assets.at(-1)?.id;
    if (!nextCursor || nextCursor === cursorId) {
      break;
    }
    cursorId = nextCursor;
  }

  return { entries, paymentSources: context.paymentSources };
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
  adminClient?: PaymentNodeClient;
}): Promise<RegistryInboxEntry> {
  if (!isPendingRegistrationState(params.reference.state)) {
    return referenceToRegistryInboxEntry(params.reference);
  }

  const adminClient = params.adminClient ?? createInboxAdminPaymentNodeClient();
  const remote = await adminClient.getRegistryInboxById({
    id: params.reference.paymentNodeId,
    network: params.network,
  });

  if (!remote) {
    return referenceToRegistryInboxEntry(params.reference);
  }

  const updated = await saveInboxAgentReference({
    userId: params.userId,
    network: params.network,
    entry: remote,
    executingWallet: getExecutingWalletFromReference(params.reference),
    smartContractAddress: params.reference.smartContractAddress,
  });

  return referenceToRegistryInboxEntry(updated);
}

export async function listOwnedInboxAgentsForUser(params: {
  userId: string;
  network: PaymentNodeNetwork;
  take: number;
  cursor?: string;
  filterStatus?: RegistryStatusFilter;
  search?: string;
}): Promise<ListOwnedInboxAgentsResult> {
  const adminClient = createInboxAdminPaymentNodeClient();

  const references = await prisma.inboxAgentReference.findMany({
    where: {
      userId: params.userId,
      networkIdentifier: params.network,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const refreshedDbAssets = await mapWithConcurrency(
    references,
    REFRESH_CONCURRENCY,
    (reference) =>
      refreshInboxAgentReference({
        userId: params.userId,
        network: params.network,
        reference,
        adminClient,
      }),
  );

  const { entries: legacyAssets } = await listLegacyOwnedInboxEntries({
    userId: params.userId,
    network: params.network,
    adminClient,
  });

  const assetsById = new Map<string, RegistryInboxEntry>();
  for (const entry of legacyAssets) assetsById.set(entry.id, entry);
  for (const entry of refreshedDbAssets) assetsById.set(entry.id, entry);

  const filteredAssets = sortInboxEntriesByCreatedAtDesc(
    Array.from(assetsById.values()),
  )
    .filter((entry) => matchesSearch(entry, params.search))
    .filter((entry) => matchesFilterStatus(entry, params.filterStatus));

  const safeStartIndex = (() => {
    if (!params.cursor) return 0;

    const cursorIndex = filteredAssets.findIndex(
      (entry) => entry.id === params.cursor,
    );
    if (cursorIndex < 0) {
      throw new StaleInboxAgentCursorError(params.cursor);
    }

    return cursorIndex + 1;
  })();
  const Assets = filteredAssets.slice(
    safeStartIndex,
    safeStartIndex + params.take,
  );

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
  adminClient: PaymentNodeClient;
}): Promise<OwnedInboxAgent | null> {
  const remote = await params.adminClient.getRegistryInboxById({
    id: params.reference.paymentNodeId,
    network: params.network,
  });

  const executingWallet = getExecutingWalletFromReference(params.reference);
  if (!remote) {
    return {
      source: "db",
      reference: params.reference,
      entry: referenceToRegistryInboxEntry(params.reference),
      executingWallet,
      smartContractAddress: params.reference.smartContractAddress,
      remoteMissing: true,
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

async function findLegacyOwnedInboxAgent(params: {
  userId: string;
  network: PaymentNodeNetwork;
  adminClient: PaymentNodeClient;
  predicate: (entry: RegistryInboxEntry) => boolean;
}): Promise<OwnedInboxAgent | null> {
  const { entries, paymentSources } = await listLegacyOwnedInboxEntries({
    userId: params.userId,
    network: params.network,
    adminClient: params.adminClient,
  });
  const entry = entries.find(params.predicate) ?? null;
  if (!entry) return null;

  const { wallet, smartContractAddress } = findExecutingWalletForEntry({
    entry,
    paymentSources,
  });

  return {
    source: "legacy-wallet",
    reference: null,
    entry,
    executingWallet: wallet,
    smartContractAddress,
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
  const adminClient = createInboxAdminPaymentNodeClient();

  if (reference) {
    return getOwnedInboxAgentFromReference({
      userId: params.userId,
      network: params.network,
      reference,
      adminClient,
    });
  }

  return findLegacyOwnedInboxAgent({
    userId: params.userId,
    network: params.network,
    adminClient,
    predicate: (entry) => entry.id === params.inboxAgentId,
  });
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
  const adminClient = createInboxAdminPaymentNodeClient();

  if (reference) {
    const owned = await getOwnedInboxAgentFromReference({
      userId: params.userId,
      network: params.network,
      reference,
      adminClient,
    });
    if (owned) return owned;
  }

  return findLegacyOwnedInboxAgent({
    userId: params.userId,
    network: params.network,
    adminClient,
    predicate: (entry) => entry.agentIdentifier === params.agentIdentifier,
  });
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
