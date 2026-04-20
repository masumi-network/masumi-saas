import prisma from "@masumi/database/client";

import { createPaymentNodeClient, paymentNodeConfig } from "@/lib/payment-node";
import { getPaymentNodeApiKeyTokenForUser } from "@/lib/payment-node/get-user-client";

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

async function getKnownInboxAgentWalletIdsForUser(
  userId: string,
): Promise<string[]> {
  const refs = await prisma.inboxAgentReference.findMany({
    where: {
      userId,
    },
    select: {
      executingWalletId: true,
    },
  });

  return toUniqueWalletIds(refs.map((ref) => ref.executingWalletId));
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
  const [knownAgentWalletIds, knownInboxAgentWalletIds] = await Promise.all([
    getKnownAgentWalletIdsForUser(params.userId),
    getKnownInboxAgentWalletIdsForUser(params.userId),
  ]);
  const nextWalletIds = toUniqueWalletIds([
    ...currentWalletIds,
    ...knownAgentWalletIds,
    ...knownInboxAgentWalletIds,
    ...requestedWalletIds,
  ]);

  const alreadyScoped =
    keyStatus.walletScopeEnabled &&
    currentWalletIds.length === nextWalletIds.length &&
    nextWalletIds.every((walletId) => currentWalletIds.includes(walletId));
  if (alreadyScoped) return;

  const adminClient = createPaymentNodeClient(baseUrl, adminApiKey);
  await adminClient.updateApiKey({
    id: keyStatus.id,
    walletScopeEnabled: true,
    WalletScopeHotWalletIds: nextWalletIds,
  });
}
