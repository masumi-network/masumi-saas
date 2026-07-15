/**
 * Payment node API client (server-side only).
 * All requests use header "token" for API key auth.
 * Responses are parsed with Zod schemas to stay in sync with the payment node API.
 */

import { z } from "zod";

import { createPaymentSchemaOutput } from "@/lib/x402/schemas";

import type {
  AddWalletToSourceInput,
  AddWalletToSourceOutput,
  AgentMetadata,
  CreateApiKeyInput,
  CreateApiKeyOutput,
  CreatePaymentInput,
  DeregisterAgentInput,
  DeregisterInboxAgentInput,
  GeneratedWallet,
  GetPaymentSourcesOutput,
  GetUtxosOutput,
  GetWalletListOutput,
  InboxAgentIdentifierMetadata,
  InboxAgentMetadata,
  ListPaymentsOutput,
  ListPurchasesOutput,
  ListWebhooksOutput,
  PatchWalletInput,
  PaymentIncomeOutput,
  PaymentNodeApiKey,
  PaymentNodeNetwork,
  RegisterAgentInput,
  RegisterInboxAgentInput,
  RegistryAgentIdentifierMetadata,
  RegistryEntry,
  RegistryInboxCountResponse,
  RegistryInboxEntry,
  RegistryStatusFilter,
  ResolvePaymentInput,
  RuntimePaymentResponse,
  SubmitPaymentResultInput,
  UpdateAgentInput,
  UpdateApiKeyInput,
  WalletStatus,
} from "./schemas";
import {
  addWalletToSourceOutputSchema,
  createApiKeyInputSchema,
  createApiKeyOutputSchema,
  createPaymentInputSchema,
  generatedWalletSchema,
  getPaymentSourcesOutputSchema,
  getUtxosOutputSchema,
  getWalletListOutputSchema,
  inboxAgentIdentifierMetadataSchema,
  listPaymentsOutputSchema,
  listPurchasesOutputSchema,
  listWebhooksOutputSchema,
  parsePaymentNodeData,
  paymentIncomeOutputSchema,
  paymentNodeApiKeySchema,
  registryAgentIdentifierMetadataSchema,
  registryEntrySchema,
  registryInboxCountResponseSchema,
  registryInboxEntrySchema,
  registryInboxListResponseSchema,
  registryInboxWalletResponseSchema,
  registryListResponseSchema,
  registryWalletResponseSchema,
  resolvePaymentInputSchema,
  runtimePaymentResponseSchema,
  submitPaymentResultInputSchema,
  updateApiKeyInputSchema,
  walletStatusSchema,
} from "./schemas";
import {
  paymentNodeX402NetworkListSchema,
  paymentNodeX402SettleOutputSchema,
  paymentNodeX402VerifyOutputSchema,
  paymentNodeX402WalletListSchema,
  paymentNodeX402WalletSchema,
} from "./x402-schemas";

export type {
  AddWalletToSourceInput,
  AddWalletToSourceOutput,
  AgentMetadata,
  CreateApiKeyInput,
  CreateApiKeyOutput,
  CreatePaymentInput,
  DeregisterAgentInput,
  DeregisterInboxAgentInput,
  GeneratedWallet,
  GetPaymentSourcesOutput,
  GetUtxosOutput,
  GetWalletListOutput,
  InboxAgentIdentifierMetadata,
  InboxAgentMetadata,
  ListPaymentsOutput,
  ListPurchasesOutput,
  ListWebhooksOutput,
  PaymentIncomeOutput,
  PaymentNodeApiKey,
  PaymentNodeNetwork,
  PaymentOrPurchaseItem,
  PaymentSourceInfo,
  PaymentSourceWallet,
  RegisterAgentInput,
  RegisterInboxAgentInput,
  RegistryAgentIdentifierMetadata,
  RegistryEntry,
  RegistryInboxCountResponse,
  RegistryInboxEntry,
  RegistryRequestState,
  RegistryStatusFilter,
  ResolvePaymentInput,
  RuntimePaymentResponse,
  SubmitPaymentResultInput,
  UpdateAgentInput,
  UpdateApiKeyInput,
  Utxo,
  UtxoAmount,
  WalletStatus,
  WebhookEndpoint,
  WebhookEventType,
} from "./schemas";

const PAYMENT_NODE_HEADER_TOKEN = "token" as const;

/**
 * Abort a payment-node request that hangs longer than this. Node's global
 * `fetch` has no short default timeout, so a stalled upstream (dropped TCP,
 * black-holed connection) would otherwise pin a worker indefinitely. Override
 * with PAYMENT_NODE_REQUEST_TIMEOUT_MS.
 */
const PAYMENT_NODE_REQUEST_TIMEOUT_MS = (() => {
  const raw = Number(process.env.PAYMENT_NODE_REQUEST_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000;
})();

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
    signal: AbortSignal.timeout(PAYMENT_NODE_REQUEST_TIMEOUT_MS),
  });
  // Read the raw body first so a non-JSON error page (HTML 502/404 from an
  // upstream gateway) still surfaces the HTTP status in the `${status}: ${msg}`
  // format that callers (e.g. deregister-agent) parse, rather than throwing an
  // opaque JSON SyntaxError that hides the status.
  const rawBody = await res.text();
  let json: PaymentNodeResponse<unknown> | null = null;
  try {
    json = rawBody
      ? (JSON.parse(rawBody) as PaymentNodeResponse<unknown>)
      : null;
  } catch {
    json = null;
  }
  if (!res.ok || json === null) {
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
      // Cap the logged body: error responses can echo addresses / ids, and an
      // unbounded body bloats logs. A short excerpt is enough to diagnose.
      rawBody.length > 500 ? `${rawBody.slice(0, 500)}…[truncated]` : rawBody,
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

    /** Update registry metadata (pay-authenticated). Use admin API key after SaaS ownership checks. */
    async updateAgent(body: UpdateAgentInput): Promise<RegistryEntry> {
      return requestParse(
        base,
        apiKey,
        `/registry/update`,
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

    /** Register an inbox agent (pay-authenticated). Use user's API key. */
    async registerInboxAgent(
      body: RegisterInboxAgentInput,
    ): Promise<RegistryInboxEntry> {
      return requestParse(
        base,
        apiKey,
        `/registry-inbox`,
        {
          method: "POST",
          body,
        },
        registryInboxEntrySchema,
      );
    },

    /** Deregister an inbox agent (pay-authenticated). Use user's API key. */
    async deregisterInboxAgent(
      body: DeregisterInboxAgentInput,
    ): Promise<RegistryInboxEntry> {
      return requestParse(
        base,
        apiKey,
        `/registry-inbox/deregister`,
        {
          method: "POST",
          body,
        },
        registryInboxEntrySchema,
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

    /** Permanently delete an inbox registry entry from the payment node DB (admin only). */
    async deleteRegistryInboxEntry(id: string): Promise<RegistryInboxEntry> {
      return requestParse(
        base,
        apiKey,
        `/registry-inbox`,
        {
          method: "DELETE",
          body: { id },
        },
        registryInboxEntrySchema,
      );
    },

    /** List registry requests (pay-authenticated). Use user's API key. */
    async getRegistry(params: {
      network: PaymentNodeNetwork;
      cursorId?: string;
      limit?: number;
      filterSmartContractAddress?: string | null;
      filterPaymentSourceType?: "Web3CardanoV1" | "Web3CardanoV2";
      filterStatus?: RegistryStatusFilter;
    }): Promise<{ Assets: RegistryEntry[] }> {
      return requestParse(
        base,
        apiKey,
        `/registry`,
        {
          method: "GET",
          query: {
            network: params.network,
            ...(params.limit != null && { limit: String(params.limit) }),
            ...(params.cursorId && { cursorId: params.cursorId }),
            ...(params.filterSmartContractAddress != null &&
              params.filterSmartContractAddress !== "" && {
                filterSmartContractAddress: params.filterSmartContractAddress,
              }),
            ...(params.filterPaymentSourceType && {
              filterPaymentSourceType: params.filterPaymentSourceType,
            }),
            ...(params.filterStatus && { filterStatus: params.filterStatus }),
          },
        },
        registryListResponseSchema,
      );
    },

    /** List inbox registry requests (pay-authenticated). Use user's API key. */
    async getRegistryInbox(params: {
      network: PaymentNodeNetwork;
      limit?: number;
      cursorId?: string;
      filterSmartContractAddress?: string | null;
      filterStatus?: RegistryStatusFilter;
      searchQuery?: string;
    }): Promise<{ Assets: RegistryInboxEntry[] }> {
      return requestParse(
        base,
        apiKey,
        `/registry-inbox`,
        {
          method: "GET",
          query: {
            network: params.network,
            ...(params.limit != null && { limit: String(params.limit) }),
            ...(params.cursorId && { cursorId: params.cursorId }),
            ...(params.filterSmartContractAddress != null &&
              params.filterSmartContractAddress !== "" && {
                filterSmartContractAddress: params.filterSmartContractAddress,
              }),
            ...(params.filterStatus && { filterStatus: params.filterStatus }),
            ...(params.searchQuery && { searchQuery: params.searchQuery }),
          },
        },
        registryInboxListResponseSchema,
      );
    },

    /** Get single registry entry by id (pay-authenticated). Use user's API key. */
    async getRegistryById(params: {
      id: string;
      network: PaymentNodeNetwork;
      filterSmartContractAddress?: string | null;
      filterPaymentSourceType?: "Web3CardanoV1" | "Web3CardanoV2";
    }): Promise<RegistryEntry | null> {
      const PAGE_LIMIT = 100;
      const MAX_PAGES = 20;

      const scan = async (filter?: {
        filterSmartContractAddress?: string | null;
        filterPaymentSourceType?: "Web3CardanoV1" | "Web3CardanoV2";
      }): Promise<RegistryEntry | null> => {
        let cursorId: string | undefined;
        for (let page = 0; page < MAX_PAGES; page++) {
          const { Assets } = await this.getRegistry({
            network: params.network,
            cursorId,
            limit: PAGE_LIMIT,
            filterSmartContractAddress: filter?.filterSmartContractAddress,
            filterPaymentSourceType: filter?.filterPaymentSourceType,
          });
          const match = Assets.find((a) => a.id === params.id);
          if (match) return match;
          if (Assets.length === 0) return null;
          const nextCursor = Assets[Assets.length - 1]!.id;
          if (nextCursor === cursorId) return null;
          cursorId = nextCursor;
        }
        return null;
      };

      const scoped = await scan({
        filterSmartContractAddress: params.filterSmartContractAddress,
        filterPaymentSourceType: params.filterPaymentSourceType,
      });
      if (scoped) return scoped;

      if (
        params.filterSmartContractAddress != null ||
        params.filterPaymentSourceType != null
      ) {
        return scan(undefined);
      }
      return null;
    },

    /** Get single inbox registry entry by id (pay-authenticated). Use user's API key. */
    async getRegistryInboxById(params: {
      id: string;
      network: PaymentNodeNetwork;
    }): Promise<RegistryInboxEntry | null> {
      const MAX_PAGES = 20;
      let cursorId: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const { Assets } = await this.getRegistryInbox({
          network: params.network,
          cursorId,
          limit: 100,
        });
        const match = Assets.find((asset) => asset.id === params.id);
        if (match) return match;
        if (Assets.length === 0) return null;
        const nextCursor = Assets[Assets.length - 1]!.id;
        if (nextCursor === cursorId) return null;
        cursorId = nextCursor;
      }
      return null;
    },

    /** Get registry by agent identifier (pay-authenticated). */
    async getRegistryByAgentIdentifier(params: {
      agentIdentifier: string;
      network: PaymentNodeNetwork;
    }): Promise<RegistryAgentIdentifierMetadata | null> {
      const res = await fetch(
        `${base}/registry/agent-identifier?agentIdentifier=${encodeURIComponent(params.agentIdentifier)}&network=${params.network}`,
        {
          headers: { [PAYMENT_NODE_HEADER_TOKEN]: apiKey },
          signal: AbortSignal.timeout(PAYMENT_NODE_REQUEST_TIMEOUT_MS),
        },
      );
      if (res.status === 404) return null;
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? res.statusText);
      }
      const json = (await res.json()) as PaymentNodeResponse<unknown>;
      if (json.status === "success" && "data" in json && json.data != null) {
        return registryAgentIdentifierMetadataSchema.parse(json.data);
      }
      return null;
    },

    /** Get inbox registry by agent identifier (pay-authenticated). */
    async getRegistryInboxByAgentIdentifier(params: {
      agentIdentifier: string;
      network: PaymentNodeNetwork;
    }): Promise<InboxAgentIdentifierMetadata | null> {
      const res = await fetch(
        `${base}/registry-inbox/agent-identifier?agentIdentifier=${encodeURIComponent(params.agentIdentifier)}&network=${params.network}`,
        {
          headers: { [PAYMENT_NODE_HEADER_TOKEN]: apiKey },
          signal: AbortSignal.timeout(PAYMENT_NODE_REQUEST_TIMEOUT_MS),
        },
      );
      if (res.status === 404) return null;
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? res.statusText);
      }
      const json = (await res.json()) as PaymentNodeResponse<unknown>;
      if (json.status === "success" && "data" in json && json.data != null) {
        return inboxAgentIdentifierMetadataSchema.parse(json.data);
      }
      return null;
    },

    /** Get registered agent metadata for a wallet (READ). */
    async getRegisteredAgentsByWallet(params: {
      walletVkey: string;
      network: PaymentNodeNetwork;
      smartContractAddress?: string;
    }): Promise<{ Assets: AgentMetadata[] }> {
      return requestParse(
        base,
        apiKey,
        `/registry/wallet`,
        {
          method: "GET",
          query: {
            walletVkey: params.walletVkey,
            network: params.network,
            ...(params.smartContractAddress && {
              smartContractAddress: params.smartContractAddress,
            }),
          },
        },
        registryWalletResponseSchema,
      );
    },

    /** Get inbox registry metadata for a wallet (READ). */
    async getInboxAgentsByWallet(params: {
      walletVkey: string;
      network: PaymentNodeNetwork;
      smartContractAddress?: string;
    }): Promise<{ Assets: InboxAgentMetadata[] }> {
      return requestParse(
        base,
        apiKey,
        `/registry-inbox/wallet`,
        {
          method: "GET",
          query: {
            walletVkey: params.walletVkey,
            network: params.network,
            ...(params.smartContractAddress && {
              smartContractAddress: params.smartContractAddress,
            }),
          },
        },
        registryInboxWalletResponseSchema,
      );
    },

    /** List inbox registry changes since lastUpdate (diff). */
    async listRegistryInboxDiff(params: {
      network: PaymentNodeNetwork;
      lastUpdate?: string;
      limit?: number;
      cursorId?: string;
      filterSmartContractAddress?: string | null;
    }): Promise<{ Assets: RegistryInboxEntry[] }> {
      const query: Record<string, string> = {
        network: params.network,
        ...(params.lastUpdate && { lastUpdate: params.lastUpdate }),
        ...(params.limit != null && { limit: String(params.limit) }),
        ...(params.cursorId && { cursorId: params.cursorId }),
        ...(params.filterSmartContractAddress != null &&
          params.filterSmartContractAddress !== "" && {
            filterSmartContractAddress: params.filterSmartContractAddress,
          }),
      };

      return requestParse(
        base,
        apiKey,
        `/registry-inbox/diff`,
        {
          method: "GET",
          query,
        },
        registryInboxListResponseSchema,
      );
    },

    /** Count inbox registry requests. */
    async getRegistryInboxCount(params: {
      network: PaymentNodeNetwork;
      filterSmartContractAddress?: string | null;
    }): Promise<RegistryInboxCountResponse> {
      return requestParse(
        base,
        apiKey,
        `/registry-inbox/count`,
        {
          method: "GET",
          query: {
            network: params.network,
            ...(params.filterSmartContractAddress != null &&
              params.filterSmartContractAddress !== "" && {
                filterSmartContractAddress: params.filterSmartContractAddress,
              }),
          },
        },
        registryInboxCountResponseSchema,
      );
    },

    /** Create a new API key (admin only). Returns the raw token once — store it encrypted. */
    async createApiKey(body: CreateApiKeyInput): Promise<CreateApiKeyOutput> {
      const parsedBody = createApiKeyInputSchema.parse(body);
      return requestParse(
        base,
        apiKey,
        `/api-key`,
        {
          method: "POST",
          body: parsedBody,
        },
        createApiKeyOutputSchema,
      );
    },

    /** Get information about the currently authenticated API key. */
    async getApiKeyStatus(): Promise<PaymentNodeApiKey> {
      return requestParse(
        base,
        apiKey,
        `/api-key-status`,
        {
          method: "GET",
        },
        paymentNodeApiKeySchema,
      );
    },

    /** Update an existing API key (admin only). */
    async updateApiKey(body: UpdateApiKeyInput): Promise<PaymentNodeApiKey> {
      const parsedBody = updateApiKeyInputSchema.parse(body);
      return requestParse(
        base,
        apiKey,
        `/api-key`,
        {
          method: "PATCH",
          body: parsedBody,
        },
        paymentNodeApiKeySchema,
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
            RemoveSellingWallets: body.RemoveSellingWallets,
            RemovePurchasingWallets: body.RemovePurchasingWallets,
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

    /** Update wallet fields such as collection address (admin only). */
    async patchWallet(body: PatchWalletInput): Promise<WalletStatus> {
      return requestParse(
        base,
        apiKey,
        `/wallet`,
        {
          method: "PATCH",
          body,
        },
        walletStatusSchema,
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

    /** List hot wallets (admin). Wallets are no longer embedded on GET /payment-source. */
    async getWalletList(params?: {
      take?: number;
      cursorId?: string;
      paymentSourceId?: string;
      walletType?: "Selling" | "Purchasing";
      walletVkey?: string;
      walletAddress?: string;
    }): Promise<GetWalletListOutput> {
      return requestParse(
        base,
        apiKey,
        `/wallet/list`,
        {
          method: "GET",
          query: {
            ...(params?.take != null && { take: String(params.take) }),
            ...(params?.cursorId && { cursorId: params.cursorId }),
            ...(params?.paymentSourceId && {
              paymentSourceId: params.paymentSourceId,
            }),
            ...(params?.walletType && { walletType: params.walletType }),
            ...(params?.walletVkey && { walletVkey: params.walletVkey }),
            ...(params?.walletAddress && {
              walletAddress: params.walletAddress,
            }),
          },
        },
        getWalletListOutputSchema,
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

    /** Create a seller-side payment request for a MIP runtime job. */
    async createPayment(
      body: CreatePaymentInput,
    ): Promise<RuntimePaymentResponse> {
      const parsedBody = createPaymentInputSchema.parse(body);
      return requestParse(
        base,
        apiKey,
        `/payment`,
        {
          method: "POST",
          body: parsedBody,
        },
        runtimePaymentResponseSchema,
      );
    },

    /** Resolve a seller-side payment by blockchain identifier. */
    async resolvePaymentByBlockchainIdentifier(
      body: ResolvePaymentInput,
    ): Promise<RuntimePaymentResponse> {
      const parsedBody = resolvePaymentInputSchema.parse({
        ...body,
        includeHistory: body.includeHistory ?? false,
      });
      return requestParse(
        base,
        apiKey,
        `/payment/resolve-blockchain-identifier`,
        {
          method: "POST",
          body: {
            ...parsedBody,
            includeHistory: parsedBody.includeHistory ? "true" : "false",
          },
        },
        runtimePaymentResponseSchema,
      );
    },

    /** Submit completed result hash for a seller-side payment request. */
    async submitPaymentResult(
      body: SubmitPaymentResultInput,
    ): Promise<RuntimePaymentResponse> {
      const parsedBody = submitPaymentResultInputSchema.parse(body);
      return requestParse(
        base,
        apiKey,
        `/payment/submit-result`,
        {
          method: "POST",
          body: parsedBody,
        },
        runtimePaymentResponseSchema,
      );
    },

    /** Create a managed x402 EVM wallet on the payment node (keys custodied there). */
    async createX402Wallet(body: {
      networkId: string;
      type: "Purchasing" | "Selling";
      note?: string | null;
      privateKey?: string;
    }) {
      return requestParse(
        base,
        apiKey,
        `/x402/wallets`,
        { method: "POST", body },
        paymentNodeX402WalletSchema,
      );
    },

    async listX402Wallets(params?: {
      take?: number;
      cursorId?: string;
      type?: "Purchasing" | "Selling";
      networkId?: string;
    }) {
      const query: Record<string, string> = {};
      if (params?.take != null) query.take = String(params.take);
      if (params?.cursorId != null) query.cursorId = params.cursorId;
      if (params?.type != null) query.type = params.type;
      if (params?.networkId != null) query.networkId = params.networkId;
      return requestParse(
        base,
        apiKey,
        `/x402/wallets`,
        { method: "GET", query },
        paymentNodeX402WalletListSchema,
      );
    },

    /** List x402 networks registered on the payment node (admin only). */
    async listX402Networks(params?: { isTestnet?: boolean }) {
      const query: Record<string, string> = {};
      if (params?.isTestnet != null) {
        query.isTestnet = params.isTestnet ? "true" : "false";
      }
      return requestParse(
        base,
        apiKey,
        `/x402/networks`,
        { method: "GET", query },
        paymentNodeX402NetworkListSchema,
      );
    },

    async updateX402Wallet(body: { id: string; note?: string | null }) {
      return requestParse(
        base,
        apiKey,
        `/x402/wallets/update`,
        { method: "POST", body },
        paymentNodeX402WalletSchema.omit({ privateKey: true }),
      );
    },

    async deleteX402Wallet(body: { id: string }) {
      return requestParse(
        base,
        apiKey,
        `/x402/wallets/delete`,
        { method: "POST", body },
        z.object({ id: z.string() }),
      );
    },

    async bindX402WalletToNetwork(body: { id: string; networkId: string }) {
      return requestParse(
        base,
        apiKey,
        `/x402/wallets/bind-network`,
        { method: "POST", body },
        paymentNodeX402WalletSchema.omit({ privateKey: true }),
      );
    },

    async createX402Payment(body: {
      evmWalletId: string;
      paymentRequired: unknown;
      preferredNetwork?: string;
      preferredAsset?: string;
      paymentIdentifier?: string;
    }) {
      return requestParse(
        base,
        apiKey,
        `/x402/pay`,
        { method: "POST", body },
        createPaymentSchemaOutput,
      );
    },

    async verifyX402Payment(body: {
      supportedPaymentSourceId: string;
      paymentPayload: unknown;
    }) {
      return requestParse(
        base,
        apiKey,
        `/x402/verify`,
        { method: "POST", body },
        paymentNodeX402VerifyOutputSchema,
      );
    },

    async settleX402Payment(body: {
      supportedPaymentSourceId: string;
      paymentPayload: unknown;
    }) {
      return requestParse(
        base,
        apiKey,
        `/x402/settle`,
        { method: "POST", body },
        paymentNodeX402SettleOutputSchema,
      );
    },

    /** List webhook endpoints registered for the authenticated API key. */
    async listWebhooks(params?: {
      paymentSourceId?: string | null;
      cursorId?: string;
      limit?: number;
    }): Promise<ListWebhooksOutput> {
      return requestParse(
        base,
        apiKey,
        `/webhooks`,
        {
          method: "GET",
          query: {
            ...(params?.paymentSourceId != null && {
              paymentSourceId: params.paymentSourceId,
            }),
            ...(params?.cursorId && { cursorId: params.cursorId }),
            ...(params?.limit != null && { limit: String(params.limit) }),
          },
        },
        listWebhooksOutputSchema,
      );
    },
  };
}

export type PaymentNodeClient = ReturnType<typeof createPaymentNodeClient>;
