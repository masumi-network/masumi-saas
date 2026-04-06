"use client";

import type { WithdrawalDto } from "@/lib/types/withdrawal";

type ApiOk<T> = { success: true; data: T };
type ApiErr = { success: false; error: string };
export type WithdrawalApiResponse<T> = ApiOk<T> | ApiErr;

const base = "/api/withdrawals";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<WithdrawalApiResponse<T>> {
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    const data = (await response.json()) as WithdrawalApiResponse<T>;
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
      error: error instanceof Error ? error.message : "Network error occurred",
    };
  }
}

export const withdrawalApiClient = {
  async list(params?: {
    status?: "all" | "PENDING" | "COMPLETED" | "FAILED";
    limit?: number;
  }): Promise<WithdrawalApiResponse<{ withdrawals: WithdrawalDto[] }>> {
    const sp = new URLSearchParams();
    if (params?.status && params.status !== "all") {
      sp.set("status", params.status);
    }
    if (params?.limit !== undefined) {
      sp.set("limit", String(params.limit));
    }
    const q = sp.toString();
    return request<{ withdrawals: WithdrawalDto[] }>(q ? `?${q}` : "");
  },

  async get(
    id: string,
  ): Promise<WithdrawalApiResponse<{ withdrawal: WithdrawalDto }>> {
    return request<{ withdrawal: WithdrawalDto }>(`/${encodeURIComponent(id)}`);
  },

  async create(body: {
    amountUsd: number;
    network: string;
    payoutAddress: string;
    destinationLabel?: string;
  }): Promise<WithdrawalApiResponse<{ withdrawal: WithdrawalDto }>> {
    return request<{ withdrawal: WithdrawalDto }>("", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
