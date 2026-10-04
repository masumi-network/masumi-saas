import "server-only";

import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { ApiError } from "@/server/hono/errors";

import {
  checkMainnetRegistrationCredits,
  type MainnetRegistrationCreditCheck,
} from "./mainnet-registration-gate";
import { getCreditBalance, InsufficientCreditsError } from "./service";

export function throwFromMainnetRegistrationCreditCheck(
  check: MainnetRegistrationCreditCheck,
): void {
  if (check.ok) return;
  if (check.reason === "insufficient_credits") {
    throw new InsufficientCreditsError(
      check.creditsRemaining,
      check.requiredCredits,
    );
  }
  throw new ApiError(
    400,
    `This batch needs ${check.registrationsNeeded} Mainnet credits (1 per new agent) but you only have ${check.creditsRemaining}. Reduce new registrations to ${check.affordable} or fewer.`,
  );
}

export async function assertMainnetCreditsForNewRegistrations(params: {
  userId: string;
  network: PaymentNodeNetwork;
  registrationsNeeded: number;
  maxPerBatch?: number;
}): Promise<void> {
  const balance = await getCreditBalance(params.userId);
  const check = checkMainnetRegistrationCredits({
    network: params.network,
    creditsRemaining: balance.creditsRemaining,
    registrationsNeeded: params.registrationsNeeded,
    maxPerBatch: params.maxPerBatch,
  });
  throwFromMainnetRegistrationCreditCheck(check);
}
