"use client";

type Agent = {
  id: string;
  name: string;
  description: string;
  apiUrl: string;
  tags: string[];
  registrationState:
    | "RegistrationRequested"
    | "RegistrationInitiated"
    | "RegistrationConfirmed"
    | "RegistrationFailed"
    | "DeregistrationRequested"
    | "DeregistrationInitiated"
    | "DeregistrationConfirmed"
    | "DeregistrationFailed";
  verificationStatus: "PENDING" | "VERIFIED" | "REVOKED" | "EXPIRED" | null;
  createdAt: Date;
  updatedAt: Date;
};

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

class AgentApiClient {
  private baseUrl = "/api/agents";

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      const data = (await response.json()) as ApiResponse<T>;

      if (!response.ok) {
        return {
          success: false,
          error: data.success === false ? data.error : "Request failed",
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Network error occurred",
      };
    }
  }

  async getAgents(filters?: {
    verificationStatus?: "PENDING" | "VERIFIED" | "REVOKED" | "EXPIRED" | null;
    unverified?: boolean;
  }): Promise<ApiResponse<Agent[]>> {
    const params = new URLSearchParams();
    if (filters?.verificationStatus !== undefined) {
      params.set("verificationStatus", filters.verificationStatus || "");
    }
    if (filters?.unverified) {
      params.set("unverified", "true");
    }

    const queryString = params.toString();
    return this.request<Agent[]>(queryString ? `?${queryString}` : "");
  }

  async getAgent(agentId: string): Promise<ApiResponse<Agent>> {
    return this.request<Agent>(`/${agentId}`);
  }

  async registerAgent(data: {
    name: string;
    description: string;
    apiUrl: string;
    tags?: string;
  }): Promise<ApiResponse<Agent>> {
    return this.request<Agent>("", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(agentId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/${agentId}`, {
      method: "DELETE",
    });
  }

  async requestVerification(
    agentId: string,
    data: { aid: string; schemaSaid?: string },
  ): Promise<ApiResponse<Agent>> {
    return this.request<Agent>(`/${agentId}/verify`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const agentApiClient = new AgentApiClient();
export type { Agent };
