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
    registrationState: string;
    verificationStatus: string | null;
  }>;
  apiKeyCount: number;
  agentCount: number;
  verifiedAgentCount: number;
  balance: string;
};
