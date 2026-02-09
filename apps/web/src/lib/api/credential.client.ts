"use client";

type VeridianCredential = {
  id: string;
  credentialId: string;
  schemaSaid: string;
  aid: string;
  status: "ISSUED" | "REVOKED" | "EXPIRED";
  issuedAt: Date;
  expiresAt: Date | null;
};

type IssueCredentialRequest = {
  aid: string;
  schemaSaid: string;
  oobi?: string;
  attributes?: Record<string, unknown>;
  agentId: string;
  organizationId?: string;
  expiresAt?: string;
  signature?: string;
  signedMessage?: string;
};

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: string[] };

class CredentialApiClient {
  private baseUrl = "/api/credentials";

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

      const data = (await response.json()) as ApiResponse<T> & {
        details?: string[];
      };

      if (!response.ok) {
        return {
          success: false,
          error: data.success === false ? data.error : "Request failed",
          details: data.details,
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

  async issueCredential(
    data: IssueCredentialRequest,
  ): Promise<ApiResponse<VeridianCredential>> {
    return this.request<VeridianCredential>("/issue", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async checkConnection(
    aid: string,
  ): Promise<ApiResponse<{ exists: boolean }>> {
    return this.request<{ exists: boolean }>("/check-connection", {
      method: "POST",
      body: JSON.stringify({ aid }),
    });
  }

  async getIssuerOobi(): Promise<ApiResponse<{ oobi: string }>> {
    return this.request<{ oobi: string }>("/issuer-oobi", {
      method: "GET",
    });
  }

  async getSchemaSaid(): Promise<ApiResponse<{ schemaSaid: string }>> {
    return this.request<{ schemaSaid: string }>("/schema-said", {
      method: "GET",
    });
  }
}

export const credentialApiClient = new CredentialApiClient();
export type { IssueCredentialRequest, VeridianCredential };
