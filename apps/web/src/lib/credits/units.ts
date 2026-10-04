import { CREDIT_STORAGE_SCALE } from "./constants";

/** Convert user-facing credits (e.g. 0.5, 1, 20) to DB ledger units. */
export function displayCreditsToStorageUnits(displayCredits: number): number {
  return Math.round(displayCredits * CREDIT_STORAGE_SCALE);
}

/** Convert DB ledger units to user-facing credits. */
export function storageUnitsToDisplayCredits(storageUnits: number): number {
  return storageUnits / CREDIT_STORAGE_SCALE;
}
