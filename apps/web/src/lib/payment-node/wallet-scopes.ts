import prisma from "@masumi/database/client";

import {
  createPaymentNodeClient,
  paymentNodeConfig,
  type PaymentNodeNetwork,
} from "@/lib/payment-node";
import { getPaymentNodeApiKeyTokenForUser } from "@/lib/payment-node/get-user-client";
import {
  listHotWalletIds,
  listSellingWalletIdsByAddresses,
} from "@/lib/payment-node/payment-source-wallets";

const REGISTRATION_FUNDING_NETWORKS: PaymentNodeNetwork[] = [
  "Preprod",
  "Mainnet",
];

function toUniqueWalletIds(
  walletIds: Array<string | null | undefined>,
): string[] {
  return [
    ...new Set(
      walletIds.filter((walletId): walletId is string =>
        Boolean(walletId?.trim()),
      ),
    ),
  ];
}

async function getKnownAgentWalletIdsForUser(
  userId: string,
): Promise<string[]> {
  const refs = await prisma.agentReference.findMany({
    where: {
      agent: {
        userId,
      },
      sellingWalletId: {
        not: null,
      },
    },
    select: {
      sellingWalletId: true,
    },
  });

  return toUniqueWalletIds(refs.map((ref) => ref.sellingWalletId));
}

function getConfiguredRegistrationFundingWalletAddresses(): Set<string> {
  const addresses = new Set<string>();
  for (const network of REGISTRATION_FUNDING_NETWORKS) {
    for (const address of paymentNodeConfig.getRegistrationFundingWallets(
      network,
    )) {
      addresses.add(address);
    }
  }
  return addresses;
}

async function getRegistrationFundingWalletIds(params: {
  adminClient: ReturnType<typeof createPaymentNodeClient>;
  walletAddresses: Set<string>;
}): Promise<string[]> {
  return listSellingWalletIdsByAddresses(
    params.adminClient,
    params.walletAddresses,
  );
}

export async function ensureUserPaymentNodeKeyScopedToWallets(params: {
  userId: string;
  walletIds: Array<string | null | undefined>;
}): Promise<void> {
  const requestedWalletIds = toUniqueWalletIds(params.walletIds);
  if (requestedWalletIds.length === 0) return;

  const token = await getPaymentNodeApiKeyTokenForUser(params.userId);
  if (!token) {
    throw new Error("Payment node API key is not configured for user");
  }

  const baseUrl = paymentNodeConfig.getBaseUrl();
  const adminApiKey = paymentNodeConfig.getAdminApiKey();

  const userClient = createPaymentNodeClient(baseUrl, token);
  const keyStatus = await userClient.getApiKeyStatus();

  const currentWalletIds = keyStatus.WalletScopes.map(
    (walletScope) => walletScope.hotWalletId,
  );
  const knownAgentWalletIds = await getKnownAgentWalletIdsForUser(
    params.userId,
  );

  const fundingWalletAddresses =
    getConfiguredRegistrationFundingWalletAddresses();
  let adminClient: ReturnType<typeof createPaymentNodeClient> | null = null;
  if (fundingWalletAddresses.size > 0) {
    adminClient = createPaymentNodeClient(baseUrl, adminApiKey);
  }
  const registrationFundingWalletIds = new Set(
    adminClient
      ? await getRegistrationFundingWalletIds({
          adminClient,
          walletAddresses: fundingWalletAddresses,
        })
      : [],
  );
  const isRegistrationFundingWallet = (walletId: string) =>
    registrationFundingWalletIds.has(walletId);
  const currentAllowedWalletIds = toUniqueWalletIds(
    currentWalletIds.filter(
      (walletId) => !isRegistrationFundingWallet(walletId),
    ),
  );
  // Inbox-agent references and configured funding wallets can point at shared
  // funding wallets. Never add those wallets to user API-key scopes.
  const nextWalletIds = toUniqueWalletIds([
    ...currentWalletIds,
    ...knownAgentWalletIds,
    ...requestedWalletIds,
  ]).filter((walletId) => !isRegistrationFundingWallet(walletId));

  const updateClient =
    adminClient ?? createPaymentNodeClient(baseUrl, adminApiKey);
  const existingHotWalletIds = await listHotWalletIds(updateClient);
  const scopedWalletIds = nextWalletIds.filter((walletId) =>
    existingHotWalletIds.has(walletId),
  );
  const currentScopedWalletIds = currentAllowedWalletIds.filter((walletId) =>
    existingHotWalletIds.has(walletId),
  );

  const missingRequestedWalletIds = requestedWalletIds.filter(
    (walletId) => !existingHotWalletIds.has(walletId),
  );
  if (missingRequestedWalletIds.length > 0) {
    throw new Error(
      `Payment node hot wallets missing requested scope targets: ${missingRequestedWalletIds.join(", ")}`,
    );
  }

  const hasUnscopedRequestedHotWallets = requestedWalletIds.some(
    (walletId) => !currentScopedWalletIds.includes(walletId),
  );
  const scopesMatch =
    currentScopedWalletIds.length === scopedWalletIds.length &&
    scopedWalletIds.every((walletId) =>
      currentScopedWalletIds.includes(walletId),
    );

  const alreadyScoped =
    keyStatus.walletScopeEnabled &&
    !hasUnscopedRequestedHotWallets &&
    scopesMatch;
  if (alreadyScoped) return;

  await updateClient.updateApiKey({
    id: keyStatus.id,
    walletScopeEnabled: true,
    WalletScopeHotWalletIds: scopedWalletIds,
  });
}
