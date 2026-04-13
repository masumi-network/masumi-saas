"use client";

import type { RegistryServicePaths } from "@/lib/registry-service/generated-client";

type RegistryEntryRequest = NonNullable<
  RegistryServicePaths["/registry-entry/"]["post"]["requestBody"]
>["content"]["application/json"];
type RegistryEntryResponse =
  RegistryServicePaths["/registry-entry/"]["post"]["responses"][200]["content"]["application/json"];
type InboxAgentRegistrationRequest = NonNullable<
  RegistryServicePaths["/inbox-agent-registration/"]["post"]["requestBody"]
>["content"]["application/json"];
type InboxAgentRegistrationResponse =
  RegistryServicePaths["/inbox-agent-registration/"]["post"]["responses"][200]["content"]["application/json"];

export type RegistryEntry = RegistryEntryResponse["data"]["entries"][number];
export type RegistryEntryFilter = NonNullable<RegistryEntryRequest["filter"]>;
export type InboxAgentRegistration =
  InboxAgentRegistrationResponse["data"]["registrations"][number];
export type InboxAgentRegistrationFilter = NonNullable<
  InboxAgentRegistrationRequest["filter"]
>;

type PaginatedDiscoveryResult<T> =
  | {
      success: true;
      data: {
        items: T[];
        nextCursor: string | null;
      };
    }
  | {
      success: false;
      error: string;
    };

function getErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object") {
    const error =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : null;
    const message =
      "message" in payload && typeof payload.message === "string"
        ? payload.message
        : null;

    if (error) return error;
    if (message) return message;
  }

  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 503) return "Registry discovery is currently unavailable";
  return "Request failed";
}

function extractList<T>(
  payload: unknown,
  collectionKey: "entries" | "registrations",
) {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object" &&
    collectionKey in payload.data
  ) {
    const data = payload.data as Record<string, unknown>;
    if (Array.isArray(data[collectionKey])) {
      return data[collectionKey] as T[];
    }
  }

  return [];
}

async function readJsonSafely(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

class RegistryDiscoveryClient {
  private baseUrl = "/api/v1";
  private internalInboxBaseUrl = "/api/registry-discovery";

  private async postCollection<T extends { id: string }>(
    endpoint: string,
    body: RegistryEntryRequest | InboxAgentRegistrationRequest,
    collectionKey: "entries" | "registrations",
  ): Promise<PaginatedDiscoveryResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = await readJsonSafely(response);

      if (!response.ok) {
        return {
          success: false,
          error: getErrorMessage(payload, response.status),
        };
      }

      const items = extractList<T>(payload, collectionKey);

      return {
        success: true,
        data: {
          items,
          nextCursor:
            items.length === (body.limit ?? 10)
              ? (items.at(-1)?.id ?? null)
              : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Network error occurred",
      };
    }
  }

  async getRegistryEntries(
    body: RegistryEntryRequest,
  ): Promise<PaginatedDiscoveryResult<RegistryEntry>> {
    return this.postCollection<RegistryEntry>(
      "/registry-entry",
      body,
      "entries",
    );
  }

  async getInboxAgentRegistrations(
    body: InboxAgentRegistrationRequest,
  ): Promise<PaginatedDiscoveryResult<InboxAgentRegistration>> {
    try {
      const response = await fetch(
        `${this.internalInboxBaseUrl}/inbox-agent-registrations`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const payload = await readJsonSafely(response);

      if (!response.ok) {
        return {
          success: false,
          error: getErrorMessage(payload, response.status),
        };
      }

      const items = extractList<InboxAgentRegistration>(
        payload,
        "registrations",
      );

      return {
        success: true,
        data: {
          items,
          nextCursor:
            items.length === (body.limit ?? 10)
              ? (items.at(-1)?.id ?? null)
              : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Network error occurred",
      };
    }
  }
}

export const registryDiscoveryClient = new RegistryDiscoveryClient();
