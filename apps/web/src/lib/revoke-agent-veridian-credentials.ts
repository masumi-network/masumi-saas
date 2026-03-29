import prisma from "@masumi/database/client";

import { veridianConfig } from "@/lib/config/veridian.config";
import { revokeIssuedCredential } from "@/lib/veridian";

/**
 * After an agent is deregistered on the registry, revoke Veridian credentials tied to it.
 * Best-effort: deregistration already succeeded on-chain; failures are logged, not thrown.
 */
export async function revokeVeridianCredentialsAfterDeregister(
  agentId: string,
): Promise<void> {
  if (!veridianConfig.credentialServerUrl) {
    console.warn(
      `[deregister] Skipping Veridian revocation for agent ${agentId}: VERIDIAN_CREDENTIAL_SERVER_URL not set`,
    );
    return;
  }

  const revokedAt = new Date();

  await prisma.veridianCredential.updateMany({
    where: { agentId, status: "PENDING" },
    data: { status: "REVOKED", revokedAt },
  });

  const issued = await prisma.veridianCredential.findMany({
    where: { agentId, status: "ISSUED" },
  });

  for (const row of issued) {
    const result = await revokeIssuedCredential(row.credentialId, row.aid);
    if (
      result.status === "revoked" ||
      result.status === "already_revoked" ||
      result.status === "not_found"
    ) {
      await prisma.veridianCredential.update({
        where: { id: row.id },
        data: { status: "REVOKED", revokedAt },
      });
      continue;
    }
    console.error(
      `[deregister] Veridian revoke failed for agent ${agentId} credential ${row.credentialId}:`,
      result.message,
    );
  }

  const stillIssued = await prisma.veridianCredential.count({
    where: { agentId, status: "ISSUED" },
  });

  if (stillIssued > 0) {
    return;
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { verificationStatus: true },
  });
  if (!agent) {
    return;
  }

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      veridianCredentialId: null,
      ...(agent.verificationStatus === "VERIFIED"
        ? { verificationStatus: "REVOKED" as const }
        : {}),
    },
  });
}
