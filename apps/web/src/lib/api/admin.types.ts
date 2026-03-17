/**
 * Shared types for admin agents API. Used by server functions and UI.
 */

export type AdminAgentRow = {
  id: string;
  name: string;
  apiUrl: string;
  registrationState: string;
  verificationStatus: string | null;
  agentIdentifier: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
};

export type AdminAgentsPagination = {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
};

export type GetAdminAgentsSuccess = {
  success: true;
  data: {
    agents: AdminAgentRow[];
    pagination: AdminAgentsPagination;
    search: string;
  };
};

export type GetAdminAgentsError = {
  success: false;
  error: string;
};

export type GetAdminAgentsResult = GetAdminAgentsSuccess | GetAdminAgentsError;
