import "server-only";

import prisma from "@masumi/database/client";

import { isKycVerificationEnabled } from "@/lib/config/verification.config";
import type { KycStatus } from "@/lib/sumsub";

/**
 * Lightweight KYC gate for network-site registration fulfill.
 * Does not live-poll Sumsub (continue page can send users to /verification).
 */
export async function getKycStatusForUser(
  userId: string,
): Promise<KycStatus | "DISABLED"> {
  if (!isKycVerificationEnabled()) {
    return "DISABLED";
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      kycVerification: { select: { status: true } },
    },
  });

  return (user?.kycVerification?.status as KycStatus | undefined) ?? "PENDING";
}
