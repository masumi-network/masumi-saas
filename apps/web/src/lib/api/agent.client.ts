"use client";

import type { AgentPricing } from "@/lib/utils";

type Agent = {
  id: string;
  name: string;
  summary: string | null;
  description: string | null;
  apiUrl: string;
  tags: string[];
  icon: string | null;
  metadata?: string | null;
  agentIdentifier: string | null;
  pricing: AgentPricing | null;
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

export type GetAgentsResult =
  | { success: true; data: Agent[]; nextCursor: string | null }
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

  async getAgents(
    filters?: {
      verificationStatus?:
        | "PENDING"
        | "VERIFIED"
        | "REVOKED"
        | "EXPIRED"
        | null;
      unverified?: boolean;
      registrationState?:
        | "RegistrationRequested"
        | "RegistrationInitiated"
        | "RegistrationConfirmed"
        | "RegistrationFailed"
        | "DeregistrationRequested"
        | "DeregistrationInitiated"
        | "DeregistrationConfirmed"
        | "DeregistrationFailed";
      registrationStateIn?: string[];
      search?: string;
    },
    options?: { cursorId?: string; take?: number },
  ): Promise<GetAgentsResult> {
    const params = new URLSearchParams();
    if (filters?.verificationStatus !== undefined) {
      params.set("verificationStatus", filters.verificationStatus || "");
    }
    if (filters?.unverified) {
      params.set("unverified", "true");
    }
    if (filters?.registrationState) {
      params.set("registrationState", filters.registrationState);
    }
    if (
      filters?.registrationStateIn &&
      filters.registrationStateIn.length > 0
    ) {
      params.set("registrationStateIn", filters.registrationStateIn.join(","));
    }
    if (filters?.search?.trim()) {
      params.set("search", filters.search.trim());
    }
    if (options?.cursorId) {
      params.set("cursor", options.cursorId);
    }
    if (options?.take !== undefined) {
      params.set("take", String(options.take));
    }

    const queryString = params.toString();
    const url = queryString ? `?${queryString}` : "";
    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = (await response.json()) as
        | { success: true; data: Agent[]; nextCursor: string | null }
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

  async getAgent(agentId: string): Promise<ApiResponse<Agent>> {
    return this.request<Agent>(`/${agentId}`);
  }

  async registerAgent(data: {
    name: string;
    summary?: string;
    description?: string;
    apiUrl: string;
    tags?: string;
    icon?: string;
    pricing?: AgentPricing;
    authorName?: string;
    authorEmail?: string;
    organization?: string;
    contactOther?: string;
    termsOfUseUrl?: string;
    privacyPolicyUrl?: string;
    otherUrl?: string;
    capabilityName?: string;
    capabilityVersion?: string;
    exampleOutputs?: Array<{ name: string; url: string; mimeType: string }>;
  }): Promise<ApiResponse<Agent>> {
    return this.request<Agent>("", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAgent(
    agentId: string,
    data: {
      name?: string;
      summary?: string | null;
      description?: string | null;
      tags?: string[];
      icon?: string | null;
      pricing?: AgentPricing | null;
      authorName?: string;
      authorEmail?: string;
      organization?: string;
      contactOther?: string;
      termsOfUseUrl?: string;
      privacyPolicyUrl?: string;
      otherUrl?: string;
      capabilityName?: string;
      capabilityVersion?: string;
      exampleOutputs?: Array<{ name: string; url: string; mimeType: string }>;
    },
  ): Promise<ApiResponse<Agent>> {
    return this.request<Agent>(`/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(agentId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/${agentId}`, {
      method: "DELETE",
    });
  }

  async getCounts(): Promise<
    | {
        success: true;
        data: {
          all: number;
          registered: number;
          deregistered: number;
          pending: number;
          failed: number;
          verified: number;
        };
      }
    | { success: false; error: string }
  > {
    try {
      const response = await fetch(`${this.baseUrl}/counts`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = (await response.json()) as
        | {
            success: true;
            data: {
              all: number;
              registered: number;
              deregistered: number;
              pending: number;
              failed: number;
              verified: number;
            };
          }
        | { success: false; error: string };
      if (!response.ok) {
        return {
          success: false,
          error: json.success === false ? json.error : "Request failed",
        };
      }
      if (json.success) {
        return { success: true, data: json.data };
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

  async requestVerification(
    agentId: string,
    data: { aid: string; schemaSaid?: string },
  ): Promise<ApiResponse<Agent>> {
    return this.request<Agent>(`/${agentId}/verify`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getVerificationChallenge(
    agentId: string,
    regenerate = false,
  ): Promise<
    ApiResponse<{
      challenge: string;
      secret: string;
      generatedAt: string | null;
    }>
  > {
    if (regenerate) {
      return this.request<{
        challenge: string;
        secret: string;
        generatedAt: string | null;
      }>(`/${agentId}/verification-challenge`, {
        method: "POST",
        body: JSON.stringify({ regenerate: true }),
      });
    }
    return this.request<{
      challenge: string;
      secret: string;
      generatedAt: string | null;
    }>(`/${agentId}/verification-challenge`, { method: "GET" });
  }

  async testVerificationEndpoint(
    agentId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(
      `/${agentId}/test-verification-endpoint`,
      { method: "POST" },
    );
  }
}

export const agentApiClient = new AgentApiClient();
export type { Agent };
