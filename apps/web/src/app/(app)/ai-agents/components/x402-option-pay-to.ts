export function resolvePayToOnChainChange({
  currentPayTo,
  previousFacilitatorAddress,
  nextFacilitatorAddress,
}: {
  currentPayTo: string;
  previousFacilitatorAddress: string | null | undefined;
  nextFacilitatorAddress: string | null | undefined;
}): string | undefined {
  const facilitatorAddress = nextFacilitatorAddress?.trim();
  if (!facilitatorAddress) return undefined;

  const payToEmpty = !currentPayTo.trim();
  const previousFacilitator = previousFacilitatorAddress?.trim();
  const payToWasPreviousFacilitator =
    previousFacilitator != null &&
    currentPayTo.toLowerCase() === previousFacilitator.toLowerCase();

  if (payToEmpty || payToWasPreviousFacilitator) {
    return facilitatorAddress;
  }

  return undefined;
}
