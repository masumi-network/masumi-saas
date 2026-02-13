export type DashboardOverview = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  };
  kycStatus:
    | "PENDING"
    | "REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "VERIFIED"
    | "REVOKED"
    | "EXPIRED";
  kycCompletedAt: Date | null;
  kycRejectionReason: string | null;
  /** Set when KYC status lookup failed; UI should show error instead of status-driven prompts */
  kycError?: string;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
  organizationCount: number;
  agents: Array<{
    id: string;
    name: string;
    icon: string | null;
    registrationState: string;
    verificationStatus: string | null;
  }>;
  apiKeys: Array<{
    id: string;
    name: string | null;
    prefix: string | null;
  }>;
  apiKeyCount: number;
  agentCount: number;
  verifiedAgentCount: number;
  balance: string;
  /** Revenue/earnings in USD (placeholder until payment service integrated) */
  revenue: string;
};
