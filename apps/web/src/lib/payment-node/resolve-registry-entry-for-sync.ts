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
    });
  } catch {
    return null;
  }
}
