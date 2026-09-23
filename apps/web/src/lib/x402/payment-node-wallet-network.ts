import "server-only";

import type { PaymentNodeClient } from "@/lib/payment-node";
import { rethrowPaymentNodeClientError } from "@/lib/payment-node/errors";
import { resolvePaymentNodeNetworkId } from "@/lib/payment-node/resolve-payment-node-x402-network";
import {
  paymentNodeX402WalletListSchema,
  paymentNodeX402WalletSchema,
} from "@/lib/payment-node/x402-schemas";

/** Resolve (or bind) the payment-node wallet row for a chain. Same EVM key, per-network row. */
export async function resolvePaymentNodeWalletIdForCaip2(
  client: PaymentNodeClient,
  params: {
    paymentNodeWalletId: string;
    address: string;
    type: "Purchasing" | "Selling";
    caip2Network: string;
  },
): Promise<string> {
  const networkId = await resolvePaymentNodeNetworkId(params.caip2Network);
  const listed = paymentNodeX402WalletListSchema.parse(
    await client.listX402Wallets({ type: params.type, networkId }),
  );
  const existing = listed.Wallets.find(
    (wallet) =>
      wallet.caip2Network === params.caip2Network &&
      wallet.address.toLowerCase() === params.address.toLowerCase(),
  );
  if (existing != null) {
    return existing.id;
  }

  try {
    const bound = paymentNodeX402WalletSchema.omit({ privateKey: true }).parse(
      await client.bindX402WalletToNetwork({
        id: params.paymentNodeWalletId,
        networkId,
      }),
    );
    return bound.id;
  } catch (error) {
    rethrowPaymentNodeClientError(error);
  }
}

export function extractCaip2FromPayInput(input: {
  preferredNetwork?: string;
  paymentRequired: unknown;
}): string | undefined {
  const preferred = input.preferredNetwork?.trim();
  if (preferred) return preferred;

  if (
    typeof input.paymentRequired === "object" &&
    input.paymentRequired != null &&
    "accepts" in input.paymentRequired
  ) {
    const accepts = (input.paymentRequired as { accepts?: unknown }).accepts;
    if (Array.isArray(accepts)) {
      for (const requirement of accepts) {
        if (
          typeof requirement === "object" &&
          requirement != null &&
          "network" in requirement &&
          typeof (requirement as { network?: unknown }).network === "string"
        ) {
          return (requirement as { network: string }).network;
        }
      }
    }
  }
  return undefined;
}
