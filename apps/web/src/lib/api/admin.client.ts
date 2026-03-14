"use client";

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

type GetAdminAgentsSuccess = {
  success: true;
  data: {
    agents: AdminAgentRow[];
    pagination: AdminAgentsPagination;
    search: string;
  };
};

type GetAdminAgentsError = {
  success: false;
  error: string;
};

export type GetAdminAgentsResult = GetAdminAgentsSuccess | GetAdminAgentsError;

class AdminApiClient {
  private baseUrl = "/api/admin";

  async getAgents(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<GetAdminAgentsResult> {
    try {
      const searchParams = new URLSearchParams();
      if (params.page != null && params.page > 1) {
        searchParams.set("page", String(params.page));
      }
      if (params.limit != null) {
        searchParams.set("limit", String(params.limit));
      }
      if (params.search?.trim()) {
        searchParams.set("search", params.search.trim());
      }
      const query = searchParams.toString();
      const url = query
        ? `${this.baseUrl}/agents?${query}`
        : `${this.baseUrl}/agents`;
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
      });
      const json = (await response.json()) as
        | GetAdminAgentsSuccess
        | GetAdminAgentsError;
      if (!response.ok) {
        return {
          success: false,
          error: json.success === false ? json.error : "Request failed",
        };
      }
      return json;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Network error occurred",
      };
    }
  }
}

export const adminApiClient = new AdminApiClient();
