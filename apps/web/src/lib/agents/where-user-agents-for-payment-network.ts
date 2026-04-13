import type { Prisma } from "@masumi/database";

/**
 * Agents visible for a payment-network-scoped request.
 *
 * Prefer {@link Agent.networkIdentifier}. If it is null (legacy / incomplete row),
 * fall back to {@link AgentReference.networkIdentifier} instead of matching **all**
 * networks — otherwise the same agent could be counted on both Mainnet and Preprod.
 */
export function whereUserAgentsForPaymentNetwork(
  userId: string,
  network: string,
): Prisma.AgentWhereInput {
  return {
    userId,
    OR: [
      { networkIdentifier: network },
      {
        networkIdentifier: null,
        agentReference: { networkIdentifier: network },
      },
    ],
  };
}
