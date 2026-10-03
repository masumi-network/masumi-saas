import "server-only";

import { isDeepStrictEqual } from "node:util";

import prisma from "@masumi/database/client";
import type { X402InboundPaymentNodeContext } from "@masumi/payment-source-x402";

import { rethrowPaymentNodeClientError } from "@/lib/payment-node/errors";
import { tryCreateAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import { registryListResponseSchema } from "@/lib/payment-node/schemas";
import {
  paymentNodeX402SettleOutputSchema,
  paymentNodeX402VerifyOutputSchema,
} from "@/lib/payment-node/x402-schemas";
import { ApiError } from "@/server/hono/errors";

/** Called only after the shared payment service validates local source ownership and policy. */
async function resolvePaymentNodeSource(
  context: X402InboundPaymentNodeContext,
) {
  const reference = await prisma.agentReference.findUnique({
    where: { agentId: context.agentId },
    select: { externalId: true, networkIdentifier: true },
  });
  if (
    !reference?.externalId ||
    (reference.networkIdentifier !== "Preprod" &&
      reference.networkIdentifier !== "Mainnet")
  ) {
    throw new ApiError(503, "Agent has no payment-node registry reference");
  }
  // SaaS registry rows are registered with the admin key, after local tenant authorization.
  const client = tryCreateAdminPaymentNodeClient();
  if (client == null) throw new ApiError(503, "Payment node not configured");
  // The node's cursor is inclusive. Fetch the exact row without scanning or caching child IDs.
  const { Assets } = registryListResponseSchema.parse(
    await client.getRegistry({
      network: reference.networkIdentifier,
      cursorId: reference.externalId,
      limit: 1,
      filterPaymentSourceType: "Web3CardanoV2",
    }),
  );
  const entry = Assets[0];
  if (entry?.id !== reference.externalId) {
    throw new ApiError(503, "Payment-node registry reference was not found");
  }
  const expected = context.requirements;
  const matches = (entry.supportedPaymentSources ?? []).filter((source) => {
    if (
      source.chain !== "EVM" ||
      source.scheme !== "Exact" ||
      source.pricing.pricingType !== "Fixed"
    )
      return false;
    const price = source.pricing.fixed[0];
    return (
      price != null &&
      source.pricing.fixed.length === 1 &&
      source.network === expected.network &&
      price.asset.toLowerCase() === expected.asset.toLowerCase() &&
      BigInt(price.amount) === BigInt(expected.amount) &&
      source.payTo.toLowerCase() === expected.payTo.toLowerCase() &&
      (source.resource ?? null) === context.registeredResource &&
      isDeepStrictEqual(
        {
          ...source.extra,
          assetTransferMethod: "permit2",
          decimals: price.decimals,
        },
        expected.extra,
      )
    );
  });
  if (matches.length !== 1 || !matches[0]?.id) {
    throw new ApiError(
      503,
      "Payment node must expose one matching supported payment source with an ID",
    );
  }
  return { client, supportedPaymentSourceId: matches[0].id };
}

export async function verifyX402PaymentOnNode(
  context: X402InboundPaymentNodeContext,
) {
  try {
    const { client, supportedPaymentSourceId } =
      await resolvePaymentNodeSource(context);
    return paymentNodeX402VerifyOutputSchema.parse(
      await client.verifyX402Payment({
        supportedPaymentSourceId,
        paymentPayload: context.paymentPayload,
      }),
    ).verifyResponse;
  } catch (error) {
    rethrowPaymentNodeClientError(error);
  }
}

export async function settleX402PaymentOnNode(
  context: X402InboundPaymentNodeContext,
) {
  try {
    const { client, supportedPaymentSourceId } =
      await resolvePaymentNodeSource(context);
    const { settleResponse } = paymentNodeX402SettleOutputSchema.parse(
      await client.settleX402Payment({
        supportedPaymentSourceId,
        paymentPayload: context.paymentPayload,
      }),
    );
    if (settleResponse.network !== context.requirements.network) {
      throw new ApiError(
        502,
        "Payment node returned a settlement for a different network",
      );
    }
    return { ...settleResponse, network: context.requirements.network };
  } catch (error) {
    rethrowPaymentNodeClientError(error);
  }
}
