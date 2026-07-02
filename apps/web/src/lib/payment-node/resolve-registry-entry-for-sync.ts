import type { PaymentNodeClient, PaymentNodeNetwork } from "@/lib/payment-node";
import type { RegistryEntry } from "@/lib/payment-node/schemas";

import { tryCreateAdminPaymentNodeClient } from "./get-admin-client";
import { getPaymentNodeClientForUser } from "./get-user-client";

/**
 * Resolve a registry request row for SaaS sync. Registration is submitted with
 * the admin key, so the user-scoped list may not include the row even though
 * the admin key can read it.
 */
export async function getRegistryEntryForSync(params: {
  userId: string;
  externalId: string;
  network: PaymentNodeNetwork;
  /**
   * Payment source the registration was submitted to. Scopes the admin/user
   * paginated lookup so a freshly confirmed row is reachable even on a shared
   * payment node with many entries across other sources.
   */
  smartContractAddress?: string | null;
  userClient?: PaymentNodeClient | null;
  adminClient?: PaymentNodeClient | null;
}): Promise<RegistryEntry | null> {
  const userClient =
    params.userClient ?? (await getPaymentNodeClientForUser(params.userId));
  if (userClient) {
    try {
      const entry = await userClient.getRegistryById({
        id: params.externalId,
        network: params.network,
        filterSmartContractAddress: params.smartContractAddress,
      });
      if (entry) return entry;
    } catch {
      // Fall through to admin lookup.
    }
  }

  const adminClient = params.adminClient ?? tryCreateAdminPaymentNodeClient();
  if (!adminClient) return null;

  try {
    return await adminClient.getRegistryById({
      id: params.externalId,
      network: params.network,
      filterSmartContractAddress: params.smartContractAddress,
    });
  } catch {
    return null;
  }
}
