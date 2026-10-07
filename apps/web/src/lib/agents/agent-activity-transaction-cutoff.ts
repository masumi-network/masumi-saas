/**
 * Activity and earnings for an agent row should not include x402/cardano txs
 * from before the latest registration attempt on this row (e.g. re-registering
 * the same resource URL after deregister or a failed mint).
 */
export function resolveAgentActivityTransactionCutoff(params: {
  agentCreatedAt: Date;
  registrationInitiatedAt: Date | null | undefined;
  registrationInitiatedEventsNewestFirst: Date[];
}): Date {
  let cutoffMs = params.agentCreatedAt.getTime();

  if (params.registrationInitiatedAt) {
    cutoffMs = Math.max(cutoffMs, params.registrationInitiatedAt.getTime());
  }

  for (const eventAt of params.registrationInitiatedEventsNewestFirst) {
    cutoffMs = Math.max(cutoffMs, eventAt.getTime());
  }

  return new Date(cutoffMs);
}

export function filterAgentTransactionsOnOrAfterCutoff<
  T extends { createdAt: string },
>(transactions: T[], cutoff: Date): T[] {
  const cutoffMs = cutoff.getTime();
  return transactions.filter(
    (tx) => new Date(tx.createdAt).getTime() >= cutoffMs,
  );
}
