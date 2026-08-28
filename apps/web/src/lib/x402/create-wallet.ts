import "server-only";

import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";

import {
  createX402WalletOnPaymentNode,
  usesPaymentNodeCustody,
} from "./wallet-custody";

export async function createX402WalletWithCustody(params: {
  userId: string;
  organizationId?: string | null;
  createdByUserId?: string | null;
  type: Parameters<typeof createX402WalletOnPaymentNode>[0]["type"];
  note?: string | null;
  privateKey?: string;
  caip2Network?: string | null;
}) {
  const client = await getPaymentNodeClientForUser(params.userId);
  if (client != null) {
    return createX402WalletOnPaymentNode(params);
  }

  const { createX402ManagedWallet } =
    await import("@masumi/payment-source-x402");
  return createX402ManagedWallet(params);
}

export { usesPaymentNodeCustody };
