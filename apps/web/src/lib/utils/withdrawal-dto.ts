import type { Withdrawal } from "@masumi/database";

import type { WithdrawalDto } from "@/lib/types/withdrawal";

export function withdrawalToDto(w: Withdrawal): WithdrawalDto {
  return {
    id: w.id,
    status: w.status,
    amountUsd: w.amountUsd.toFixed(2),
    network: w.network,
    payoutAddress: w.payoutAddress,
    destinationLabel: w.destinationLabel,
    failureReason: w.failureReason,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    completedAt: w.completedAt?.toISOString() ?? null,
  };
}
