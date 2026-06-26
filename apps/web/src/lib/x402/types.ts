import type {
  X402EvmWalletType,
  X402PaymentDirection,
  X402PaymentStatus,
} from "@masumi/database";

export type X402WalletType = X402EvmWalletType;

export type X402Network = {
  id: string;
  caip2Id: string;
  displayName: string;
  rpcUrl: string;
  isTestnet: boolean;
  isEnabled: boolean;
  defaultAsset: string | null;
  facilitatorWalletId: string | null;
  facilitatorWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

export type X402Wallet = {
  id: string;
  address: string;
  type: X402WalletType;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type X402Budget = {
  id: string;
  apiKeyId: string;
  evmWalletId: string;
  evmWalletAddress: string;
  caip2Network: string;
  asset: string;
  remainingAmount: string;
  spentAmount: string;
  createdAt: string;
  updatedAt: string;
};

export type X402LowBalanceRuleStatus = "Healthy" | "Low" | "Unknown";

export type X402LowBalanceRule = {
  id: string;
  evmWalletId: string;
  evmWalletAddress: string;
  caip2Network: string;
  asset: string;
  thresholdAmount: string;
  lastKnownAmount: string | null;
  enabled: boolean;
  status: X402LowBalanceRuleStatus;
  createdAt: string;
  updatedAt: string;
};

export type X402PaymentAttempt = {
  id: string;
  createdAt: string;
  updatedAt: string;
  direction: X402PaymentDirection;
  status: X402PaymentStatus;
  apiKeyId: string | null;
  evmWalletId: string | null;
  caip2Network: string;
  asset: string;
  amount: string;
  payTo: string;
  payer: string | null;
  resource: string | null;
  paymentIdentifier: string | null;
  errorReason: string | null;
  errorMessage: string | null;
  Settlement: {
    id: string;
    success: boolean;
    txHash: string | null;
    amount: string | null;
    payer: string | null;
    createdAt: string;
  } | null;
};

export type X402WalletBalance = {
  caip2Network: string;
  displayName: string;
  error?: string;
  native?: { symbol: string; amount: string; decimals: number };
  asset?: { symbol: string | null; amount: string; decimals: number };
};

export type UserApiKeyOption = {
  id: string;
  name: string | null;
  prefix: string | null;
  start: string | null;
};
