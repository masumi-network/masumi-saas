/**
 * User balances and ledger deltas are stored as integers at this scale
 * (2 storage units = 1 display credit).
 */
export const CREDIT_STORAGE_SCALE = 2;

/** Display credits consumed per Mainnet agent registration and metadata update. */
export const CREDIT_COST = 1;

/** One-time grant for new accounts (see credits service `ensureInitialCreditGrant`). */
export const INITIAL_CREDIT_GRANT = 20;
