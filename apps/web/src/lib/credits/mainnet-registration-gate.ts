import type { PaymentNodeNetwork } from "@/lib/payment-node";

import {
  creditsRequiredForRegistrations,
  maxAgentRegistrationsForBalance,
} from "./agent-registration-quota";
import { CREDIT_COST } from "./constants";

export type MainnetRegistrationCreditCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "insufficient_credits";
      creditsRemaining: number;
      requiredCredits: number;
    }
  | {
      ok: false;
      reason: "exceeds_affordable";
      creditsRemaining: number;
      registrationsNeeded: number;
      affordable: number;
    };

/**
 * Validates Mainnet credit balance for starting N new agent registrations.
 * Preprod always passes. Zero `registrationsNeeded` passes (e.g. batch all duplicates).
 */
export function checkMainnetRegistrationCredits(params: {
  network: PaymentNodeNetwork;
  creditsRemaining: number;
  registrationsNeeded: number;
  maxPerBatch?: number;
}): MainnetRegistrationCreditCheck {
  const { network, creditsRemaining, registrationsNeeded } = params;
  if (network !== "Mainnet" || registrationsNeeded <= 0) {
    return { ok: true };
  }

  const requiredCredits = creditsRequiredForRegistrations(registrationsNeeded);
  const affordable = maxAgentRegistrationsForBalance({
    network,
    creditsRemaining,
    maxPerBatch: params.maxPerBatch ?? registrationsNeeded,
  });

  if (affordable === 0 || creditsRemaining < CREDIT_COST) {
    return {
      ok: false,
      reason: "insufficient_credits",
      creditsRemaining,
      requiredCredits: Math.max(CREDIT_COST, requiredCredits),
    };
  }

  if (registrationsNeeded > affordable) {
    return {
      ok: false,
      reason: "exceeds_affordable",
      creditsRemaining,
      registrationsNeeded,
      affordable,
    };
  }

  return { ok: true };
}
