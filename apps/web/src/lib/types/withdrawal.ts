export type WithdrawalDto = {
  id: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  amountUsd: string;
  network: string;
  payoutAddress: string;
  destinationLabel: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};
