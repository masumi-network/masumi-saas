import type { DashboardOverview } from "@/lib/types/dashboard";

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type GetDashboardOverviewResult =
  | { success: true; data: DashboardOverview }
  | { success: false; error: string };

class DashboardApiClient {
  private baseUrl = "/api/dashboard/overview";

  async getOverview(options?: {
    baseUrl?: string;
    headers?: HeadersInit;
  }): Promise<GetDashboardOverviewResult> {
    const url = options?.baseUrl
      ? `${options.baseUrl}${this.baseUrl}`
      : this.baseUrl;

    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      const json = (await response.json()) as ApiResponse<DashboardOverview>;

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
}

export const dashboardApiClient = new DashboardApiClient();
