"use client";

import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { CREDIT_COST } from "@/lib/credits/constants";

import { useCreditBalance } from "./use-credit-balance";

export function useMainnetRegistrationCreditsGate() {
  const { network } = usePaymentNetwork();
  const { data, isPending, isError, refetch } = useCreditBalance();

  const isMainnet = network === "Mainnet";
  const creditsRemaining = data?.creditsRemaining ?? 0;
  const requiredCredits = CREDIT_COST;
  const hasEnoughCredits = creditsRemaining >= requiredCredits;
  const isBlocked = isMainnet && !isPending && !isError && !hasEnoughCredits;

  return {
    isMainnet,
    isBlocked,
    hasEnoughCredits,
    creditsRemaining,
    requiredCredits,
    isPending,
    isError,
    refetch,
  };
}
