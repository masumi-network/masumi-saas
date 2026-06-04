import { CREDITS_PER_PAYMENT_EVENT } from "@/lib/credits/pricing";

const displayCreditFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
  minimumFractionDigits: 0,
});

/**
 * Formats atomic ledger credits as display units (800 atomic = 1 payment credit).
 */
export function formatCreditAmount(atomicCredits: number): string {
  const display = Math.max(0, atomicCredits) / CREDITS_PER_PAYMENT_EVENT;
  return displayCreditFormatter.format(display);
}
