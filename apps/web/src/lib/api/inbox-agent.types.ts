export type InboxAgentState =
  | "RegistrationRequested"
  | "RegistrationInitiated"
  | "RegistrationConfirmed"
  | "RegistrationFailed"
  | "DeregistrationRequested"
  | "DeregistrationInitiated"
  | "DeregistrationConfirmed"
  | "DeregistrationFailed";

export type InboxAgentFilterStatus =
  | "Registered"
  | "Deregistered"
  | "Pending"
  | "Failed";

export type InboxAgentTransaction = {
  txHash: string | null;
  status:
    | "Pending"
    | "Confirmed"
    | "FailedViaTimeout"
    | "FailedViaManualReset"
    | "RolledBack";
  confirmations: number | null;
  fees: string | null;
  blockHeight: number | null;
  blockTime: number | null;
};

export type InboxAgentWallet = {
  walletVkey: string;
  walletAddress: string;
};

export type InboxAgent = {
  error: string | null;
  id: string;
  name: string;
  description: string | null;
  agentSlug: string;
  state: InboxAgentState;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
  agentIdentifier: string | null;
  metadataVersion: number;
  sendFundingLovelace: string | null;
  SmartContractWallet: InboxAgentWallet;
  RecipientWallet: InboxAgentWallet | null;
  CurrentTransaction: InboxAgentTransaction | null;
};

export type GetInboxAgentsResult =
  | { success: true; data: InboxAgent[]; nextCursor: string | null }
  | { success: false; error: string };

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
