import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@masumi/database";
import prisma from "@masumi/database/client";

// Payout updates hold this lock across a payment-node request (default 30s).
export const AGENT_REFERENCE_UPDATE_TIMEOUT_MS = 40_000;

/** Serialize payout and registry confirmation writes for the same agent. */
export async function lockAgentReference(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  agentId: string,
): Promise<void> {
  // Preserve the existing payout lock namespace across rolling deployments.
  const hash = createHash("sha256")
    .update(`payout-address:${agentId}`, "utf8")
    .digest();
  const k1 = hash.readInt32BE(0);
  const k2 = hash.readInt32BE(4);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${k1}::integer, ${k2}::integer)`;
}

/** Preserve payout metadata changed while the registry update was pending. */
export async function confirmAgentRegistryUpdate(
  agentId: string,
  agentIdentifier: string,
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await lockAgentReference(tx, agentId);
      const reference = await tx.agentReference.findUniqueOrThrow({
        where: { agentId },
        select: { metadata: true },
      });
      const metadata =
        reference.metadata &&
        typeof reference.metadata === "object" &&
        !Array.isArray(reference.metadata)
          ? reference.metadata
          : {};

      await tx.agent.update({
        where: { id: agentId },
        data: { agentIdentifier, registrationState: "RegistrationConfirmed" },
      });
      await tx.agentReference.update({
        where: { agentId },
        data: { metadata: { ...metadata, agentIdentifier } },
      });
    },
    { timeout: AGENT_REFERENCE_UPDATE_TIMEOUT_MS },
  );
}
