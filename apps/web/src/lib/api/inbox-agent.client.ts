"use client";

import type {
  ApiResponse,
  GetInboxAgentsResult,
  InboxAgent,
  InboxAgentFilterStatus,
} from "./inbox-agent.types";

export type {
  ApiResponse,
  GetInboxAgentsResult,
  InboxAgent,
  InboxAgentFilterStatus,
};

class InboxAgentApiClient {
  private baseUrl = "/pay/api/v1/inbox-agents";

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        credentials: "include",
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

  async getInboxAgents(
    filters?: {
      filterStatus?: InboxAgentFilterStatus;
      search?: string;
    },
    options?: {
      cursorId?: string;
      take?: number;
      network?: "Mainnet" | "Preprod";
    },
  ): Promise<GetInboxAgentsResult> {
    const params = new URLSearchParams();

    if (filters?.filterStatus) {
      params.set("filterStatus", filters.filterStatus);
    }
    if (filters?.search?.trim()) {
      params.set("search", filters.search.trim());
    }
    if (options?.cursorId) {
      params.set("cursor", options.cursorId);
    }
    if (options?.take != null) {
      params.set("take", String(options.take));
    }
    if (options?.network) {
      params.set("network", options.network);
    }

    const url = params.toString() ? `?${params.toString()}` : "";

    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = (await response.json()) as
        | { success: true; data: InboxAgent[]; nextCursor: string | null }
        | { success: false; error: string };

      if (!response.ok) {
        return {
          success: false,
          error: json.success === false ? json.error : "Request failed",
        };
      }

      if (json.success) {
        return {
          success: true,
          data: json.data,
          nextCursor: json.nextCursor ?? null,
        };
      }

      return { success: false, error: "Request failed" };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Network error occurred",
      };
    }
  }

  async registerInboxAgent(
    data: {
      name: string;
      description?: string;
      agentSlug: string;
    },
    options?: { network?: "Mainnet" | "Preprod" },
  ): Promise<ApiResponse<InboxAgent>> {
    const query = options?.network ? `?network=${options.network}` : "";
    return this.request<InboxAgent>(query, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteInboxAgent(
    inboxAgentId: string,
    options?: { network?: "Mainnet" | "Preprod" },
  ): Promise<ApiResponse<InboxAgent>> {
    const query = options?.network ? `?network=${options.network}` : "";
    return this.request<InboxAgent>(`/${inboxAgentId}${query}`, {
      method: "DELETE",
    });
  }

  async deregisterInboxAgent(
    inboxAgentId: string,
    options?: { network?: "Mainnet" | "Preprod" },
  ): Promise<ApiResponse<InboxAgent>> {
    const query = options?.network ? `?network=${options.network}` : "";
    return this.request<InboxAgent>(`/${inboxAgentId}/deregister${query}`, {
      method: "POST",
    });
  }
}

export const inboxAgentApiClient = new InboxAgentApiClient();
