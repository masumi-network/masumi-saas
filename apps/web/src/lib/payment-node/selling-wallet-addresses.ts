import prisma from "@masumi/database/client";

import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";

import { tryCreateAdminPaymentNodeClient } from "./get-admin-client";

type RegistrationMetadata = {
  sellingWalletAddress?: string;
};

async function resolveWalletIdsToAddresses(
  walletIds: string[],
): Promise<string[]> {
  const uniqueWalletIds = [
    ...new Set(walletIds.filter((walletId) => walletId.length > 0)),
  ];
  if (uniqueWalletIds.length === 0) {
    return [];
  }

  const adminClient = tryCreateAdminPaymentNodeClient();
  if (!adminClient) {
    return [];
  }

  const addresses: string[] = [];
  for (const walletId of uniqueWalletIds) {
    try {
      const wallet = await adminClient.getWalletStatus({
        walletType: "Selling",
        id: walletId,
      });
      if (wallet.walletAddress.length > 0) {
        addresses.push(wallet.walletAddress);
      }
    } catch {
      // Wallet may have been removed upstream; skip.
    }
  }

  return addresses;
}

function readSellingWalletAddress(
  metadata: RegistrationMetadata | null | undefined,
): string | null {
  const address = metadata?.sellingWalletAddress?.trim();
  return address && address.length > 0 ? address : null;
}

async function resolveOrganizationSellingWalletAddresses(
  organizationId: string,
): Promise<string[]> {
  const refs = await prisma.agentReference.findMany({
    where: {
      agent: { organizationId },
    },
    select: {
      sellingWalletId: true,
      metadata: true,
    },
  });

  const addresses: string[] = [];
  const walletIdsMissingAddress: string[] = [];

  for (const ref of refs) {
    const address = readSellingWalletAddress(
      ref.metadata as RegistrationMetadata | null,
    );
    if (address) {
      addresses.push(address);
      continue;
    }
    if (ref.sellingWalletId) {
      walletIdsMissingAddress.push(ref.sellingWalletId);
    }
  }

  const lookedUp = await resolveWalletIdsToAddresses(walletIdsMissingAddress);
  return [...new Set([...addresses, ...lookedUp])];
}

async function resolveUserScopedSellingWalletAddresses(
  userId: string,
): Promise<string[]> {
  const client = await getPaymentNodeClientForUser(userId);
  if (!client) {
    return [];
  }

  const { WalletScopes } = await client.getApiKeyStatus();
  const walletIds = WalletScopes.map((scope) => scope.hotWalletId);
  return [...new Set(await resolveWalletIdsToAddresses(walletIds))];
}

export async function resolveSellingWalletAddresses(params: {
  userId: string;
  organizationId?: string;
}): Promise<string[]> {
  if (params.organizationId) {
    return resolveOrganizationSellingWalletAddresses(params.organizationId);
  }

  return resolveUserScopedSellingWalletAddresses(params.userId);
}
