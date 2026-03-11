/**
 * Payment node API client (server-side only).
 * All requests use header "token" for API key auth.
 * Responses are parsed with Zod schemas to stay in sync with the payment node API.
 */

import type { z } from "zod";

import type {
  AddWalletToSourceInput,
  AddWalletToSourceOutput,
  CreateApiKeyInput,
  CreateApiKeyOutput,
  DeregisterAgentInput,
  GeneratedWallet,
  GetPaymentSourcesOutput,
  GetUtxosOutput,
  ListPaymentsOutput,
  ListPurchasesOutput,
  PaymentIncomeOutput,
  PaymentNodeNetwork,
  RegisterAgentInput,
  RegistryEntry,
  WalletStatus,
} from "./schemas";
import {
  addWalletToSourceOutputSchema,
  createApiKeyOutputSchema,
  generatedWalletSchema,
  getPaymentSourcesOutputSchema,
  getUtxosOutputSchema,
  listPaymentsOutputSchema,
  listPurchasesOutputSchema,
  parsePaymentNodeData,
  paymentIncomeOutputSchema,
  registryEntrySchema,
  registryListResponseSchema,
  walletStatusSchema,
} from "./schemas";

export type {
  AddWalletToSourceInput,
  AddWalletToSourceOutput,
  CreateApiKeyInput,
  CreateApiKeyOutput,
  DeregisterAgentInput,
  GeneratedWallet,
  GetPaymentSourcesOutput,
  GetUtxosOutput,
  ListPaymentsOutput,
  ListPurchasesOutput,
  PaymentIncomeOutput,
  PaymentNodeNetwork,
  PaymentOrPurchaseItem,
  PaymentSourceInfo,
  PaymentSourceWallet,
  RegisterAgentInput,
  RegistryEntry,
  RegistryRequestState,
  Utxo,
  UtxoAmount,
  WalletStatus,
} from "./schemas";

const PAYMENT_NODE_HEADER_TOKEN = "token" as const;

type PaymentNodeResponse<T> =
  | { status: "success"; data: T }
  | { status: string; error?: string; message?: string };

async function requestParse<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, string>;
  },
  schema: z.ZodType<T>,
): Promise<T> {
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const url = new URL(path.startsWith("/") ? path.slice(1) : path, base);
  if (options.query) {
    Object.entries(options.query).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
  }
  const res = await fetch(url.toString(), {
    method: options.method,
    headers: {
      [PAYMENT_NODE_HEADER_TOKEN]: apiKey,
      "Content-Type": "application/json",
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const json = (await res.json()) as PaymentNodeResponse<unknown>;
  if (!res.ok) {
    const errObj = json && "error" in json ? json.error : null;
    const msg =
      (errObj && typeof errObj === "object" && "message" in errObj
        ? (errObj as { message: string }).message
        : null) ||
      (typeof errObj === "string" ? errObj : null) ||
      (json && "message" in json && json.message) ||
      res.statusText ||
      "Payment node request failed";
    console.error(
      "[Payment Node] Request failed:",
      res.status,
      url.toString(),
      JSON.stringify(json),
    );
    throw new Error(`${res.status}: ${msg}`);
  }
  if (json.status !== "success" || !("data" in json)) {
    throw new Error("Invalid payment node response");
  }
  return parsePaymentNodeData(json.data, schema);
}

// ─── Client factory ─────────────────────────────────────────────────────────

export function createPaymentNodeClient(baseUrl: string, apiKey: string) {
  const base = baseUrl.replace(/\/$/, "");

  return {
    /** Register an agent (pay-authenticated). Use user's API key. */
    async registerAgent(body: RegisterAgentInput): Promise<RegistryEntry> {
      return requestParse(
        base,
        apiKey,
        `/registry`,
        {
          method: "POST",
          body,
        },
        registryEntrySchema,
      );
    },

    /** Deregister an agent (pay-authenticated). Use user's API key. */
    async deregisterAgent(body: DeregisterAgentInput): Promise<RegistryEntry> {
      return requestParse(
        base,
        apiKey,
        `/registry/deregister`,
        {
          method: "POST",
          body,
        },
        registryEntrySchema,
      );
    },

    /** Permanently delete a registry entry from the payment node DB (admin only).
     *  Only valid for RegistrationFailed or DeregistrationConfirmed entries. */
    async deleteRegistryEntry(id: string): Promise<RegistryEntry> {
      return requestParse(
        base,
        apiKey,
        `/registry`,
        {
          method: "DELETE",
          body: { id },
        },
        registryEntrySchema,
      );
    },

    /** List registry requests (pay-authenticated). Use user's API key. */
    async getRegistry(params: {
      network: PaymentNodeNetwork;
      cursorId?: string;
    }): Promise<{ Assets: RegistryEntry[] }> {
      return requestParse(
        base,
        apiKey,
        `/registry`,
        {
          method: "GET",
          query: {
            network: params.network,
            ...(params.cursorId && { cursorId: params.cursorId }),
          },
        },
        registryListResponseSchema,
      );
    },

    /** Get single registry entry by id (pay-authenticated). Use user's API key. */
    async getRegistryById(params: {
      id: string;
      network: PaymentNodeNetwork;
    }): Promise<RegistryEntry | null> {
      // Fetch without a cursorId so the target entry is included in results.
      // Using cursorId for the target's own id would exclude it under standard
      // cursor-based pagination ("entries after this cursor").
      // Each user key only sees their own agents so the result set is small.
      const MAX_PAGES = 20;
      let cursorId: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const { Assets } = await this.getRegistry({
          network: params.network,
          cursorId,
        });
        const match = Assets.find((a) => a.id === params.id);
        if (match) return match;
        if (Assets.length === 0) return null;
        const nextCursor = Assets[Assets.length - 1]!.id;
        // Stale cursor — API didn't advance, bail to avoid an infinite loop.
        if (nextCursor === cursorId) return null;
        cursorId = nextCursor;
      }
      return null;
    },

    /** Get registry by agent identifier (pay-authenticated). */
    async getRegistryByAgentIdentifier(params: {
      agentIdentifier: string;
      network: PaymentNodeNetwork;
    }): Promise<RegistryEntry | null> {
      const res = await fetch(
        `${base}/registry/agent-identifier?agentIdentifier=${encodeURIComponent(params.agentIdentifier)}&network=${params.network}`,
        {
          headers: { [PAYMENT_NODE_HEADER_TOKEN]: apiKey },
        },
      );
      if (res.status === 404) return null;
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? res.statusText);
      }
      const json = (await res.json()) as PaymentNodeResponse<unknown>;
      if (json.status === "success" && "data" in json && json.data != null) {
        return registryEntrySchema.parse(json.data);
      }
      return null;
    },

    /** Create a new API key (admin only). Returns the raw token once — store it encrypted. */
    async createApiKey(body: CreateApiKeyInput): Promise<CreateApiKeyOutput> {
      return requestParse(
        base,
        apiKey,
        `/api-key`,
        {
          method: "POST",
          body: {
            ...body,
            UsageCredits: body.UsageCredits,
          },
        },
        createApiKeyOutputSchema,
      );
    },

    /** Add selling/purchasing wallets to an existing payment source (admin only). */
    async addWalletsToPaymentSource(
      body: AddWalletToSourceInput,
    ): Promise<AddWalletToSourceOutput> {
      return requestParse(
        base,
        apiKey,
        `/payment-source-extended`,
        {
          method: "PATCH",
          body: {
            id: body.paymentSourceId,
            AddSellingWallets: body.AddSellingWallets,
            AddPurchasingWallets: body.AddPurchasingWallets,
          },
        },
        addWalletToSourceOutputSchema,
      );
    },

    /** Get wallet status by ID (admin only). */
    async getWalletStatus(params: {
      walletType: "Selling" | "Buying";
      id: string;
    }): Promise<WalletStatus> {
      return requestParse(
        base,
        apiKey,
        `/wallet`,
        {
          method: "GET",
          query: { walletType: params.walletType, id: params.id },
        },
        walletStatusSchema,
      );
    },

    /** Generate a new wallet (admin only). Does NOT persist on payment node; use addWalletsToPaymentSource to persist. */
    async generateWallet(
      network: PaymentNodeNetwork,
    ): Promise<GeneratedWallet> {
      return requestParse(
        base,
        apiKey,
        `/wallet`,
        {
          method: "POST",
          body: { network },
        },
        generatedWalletSchema,
      );
    },

    /** Get UTXOs at a Cardano address (READ access required).
     *  Throws a 404 error if the address has no UTXOs yet. */
    async getUtxos(params: {
      address: string;
      network: PaymentNodeNetwork;
      count?: number;
      page?: number;
      order?: "asc" | "desc";
    }): Promise<GetUtxosOutput> {
      return requestParse(
        base,
        apiKey,
        `/utxos`,
        {
          method: "GET",
          query: {
            address: params.address,
            network: params.network,
            ...(params.count != null && { count: String(params.count) }),
            ...(params.page != null && { page: String(params.page) }),
            ...(params.order != null && { order: params.order }),
          },
        },
        getUtxosOutputSchema,
      );
    },

    /** List payment sources (READ). Returns id and smartContractAddress for filtering transactions. */
    async getPaymentSources(params?: {
      take?: number;
      cursorId?: string;
    }): Promise<GetPaymentSourcesOutput> {
      return requestParse(
        base,
        apiKey,
        `/payment-source`,
        {
          method: "GET",
          query: {
            ...(params?.take != null && { take: String(params.take) }),
            ...(params?.cursorId && { cursorId: params.cursorId }),
          },
        },
        getPaymentSourcesOutputSchema,
      );
    },

    /** List payments (READ). Filter by smartContractAddress for a given payment source. */
    async listPayments(params: {
      network: PaymentNodeNetwork;
      filterSmartContractAddress?: string | null;
      limit?: number;
      cursorId?: string;
      filterOnChainState?: string;
      searchQuery?: string;
      includeHistory?: boolean;
    }): Promise<ListPaymentsOutput> {
      const q: Record<string, string> = {
        network: params.network,
        ...(params.limit != null && { limit: String(params.limit) }),
        ...(params.cursorId && { cursorId: params.cursorId }),
        ...(params.filterSmartContractAddress != null &&
          params.filterSmartContractAddress !== "" && {
            filterSmartContractAddress: params.filterSmartContractAddress,
          }),
        ...(params.filterOnChainState && {
          filterOnChainState: params.filterOnChainState,
        }),
        ...(params.searchQuery && { searchQuery: params.searchQuery }),
        ...(params.includeHistory != null && {
          includeHistory: params.includeHistory ? "true" : "false",
        }),
      };
      return requestParse(
        base,
        apiKey,
        `/payment`,
        {
          method: "GET",
          query: q,
        },
        listPaymentsOutputSchema,
      );
    },

    /**
     * List payment changes since lastUpdate (diff). Same response shape as listPayments; use for polling.
     */
    async listPaymentDiff(params: {
      network: PaymentNodeNetwork;
      lastUpdate: string; // ISO timestamp
      filterSmartContractAddress?: string | null;
      limit?: number;
      cursorId?: string;
      includeHistory?: boolean;
    }): Promise<ListPaymentsOutput> {
      const q: Record<string, string> = {
        network: params.network,
        lastUpdate: params.lastUpdate,
        ...(params.limit != null && { limit: String(params.limit) }),
        ...(params.cursorId && { cursorId: params.cursorId }),
        ...(params.filterSmartContractAddress != null &&
          params.filterSmartContractAddress !== "" && {
            filterSmartContractAddress: params.filterSmartContractAddress,
          }),
        ...(params.includeHistory != null && {
          includeHistory: params.includeHistory ? "true" : "false",
        }),
      };
      return requestParse(
        base,
        apiKey,
        `/payment/diff`,
        {
          method: "GET",
          query: q,
        },
        listPaymentsOutputSchema,
      );
    },

    /** List purchases (READ). Filter by smartContractAddress for a given payment source. */
    async listPurchases(params: {
      network: PaymentNodeNetwork;
      filterSmartContractAddress?: string | null;
      limit?: number;
      cursorId?: string;
      filterOnChainState?: string;
      searchQuery?: string;
      includeHistory?: boolean;
    }): Promise<ListPurchasesOutput> {
      const q: Record<string, string> = {
        network: params.network,
        ...(params.limit != null && { limit: String(params.limit) }),
        ...(params.cursorId && { cursorId: params.cursorId }),
        ...(params.filterSmartContractAddress != null &&
          params.filterSmartContractAddress !== "" && {
            filterSmartContractAddress: params.filterSmartContractAddress,
          }),
        ...(params.filterOnChainState && {
          filterOnChainState: params.filterOnChainState,
        }),
        ...(params.searchQuery && { searchQuery: params.searchQuery }),
        ...(params.includeHistory != null && {
          includeHistory: params.includeHistory ? "true" : "false",
        }),
      };
      return requestParse(
        base,
        apiKey,
        `/purchase`,
        {
          method: "GET",
          query: q,
        },
        listPurchasesOutputSchema,
      );
    },

    /**
     * List purchase changes since lastUpdate (diff). Same response shape as listPurchases; use for polling.
     */
    async listPurchaseDiff(params: {
      network: PaymentNodeNetwork;
      lastUpdate: string; // ISO timestamp
      filterSmartContractAddress?: string | null;
      limit?: number;
      cursorId?: string;
      includeHistory?: boolean;
    }): Promise<ListPurchasesOutput> {
      const q: Record<string, string> = {
        network: params.network,
        lastUpdate: params.lastUpdate,
        ...(params.limit != null && { limit: String(params.limit) }),
        ...(params.cursorId && { cursorId: params.cursorId }),
        ...(params.filterSmartContractAddress != null &&
          params.filterSmartContractAddress !== "" && {
            filterSmartContractAddress: params.filterSmartContractAddress,
          }),
        ...(params.includeHistory != null && {
          includeHistory: params.includeHistory ? "true" : "false",
        }),
      };
      return requestParse(
        base,
        apiKey,
        `/purchase/diff`,
        {
          method: "GET",
          query: q,
        },
        listPurchasesOutputSchema,
      );
    },

    /** Get payment income (READ). Pass agentIdentifier for per-agent earnings. */
    async getPaymentIncome(params: {
      network: PaymentNodeNetwork;
      agentIdentifier?: string | null;
      startDate?: string | null; // ISO date 2024-01-01
      endDate?: string | null;
      timeZone?: string;
    }): Promise<PaymentIncomeOutput> {
      return requestParse(
        base,
        apiKey,
        `/payment/income`,
        {
          method: "POST",
          body: {
            network: params.network,
            agentIdentifier: params.agentIdentifier ?? null,
            startDate: params.startDate ?? null,
            endDate: params.endDate ?? null,
            timeZone: params.timeZone ?? "Etc/UTC",
          },
        },
        paymentIncomeOutputSchema,
      );
    },
  };
}

export type PaymentNodeClient = ReturnType<typeof createPaymentNodeClient>;
