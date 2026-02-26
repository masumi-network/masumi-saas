/**
 * Payment node API client (server-side only).
 * All requests use header "token" for API key auth.
 * Response shape: { status: "success", data: T } or error.
 */

const PAYMENT_NODE_HEADER_TOKEN = "token" as const;

export type PaymentNodeNetwork = "Preprod" | "Mainnet";

type PaymentNodeResponse<T> =
  | { status: "success"; data: T }
  | { status: string; error?: string; message?: string };

async function request<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, string>;
  },
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
  const json = (await res.json()) as PaymentNodeResponse<T>;
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
  return json.data as T;
}

// ─── Types (align with payment node API) ─────────────────────────────────────

export type RegistryRequestState =
  | "RegistrationRequested"
  | "RegistrationInitiated"
  | "RegistrationConfirmed"
  | "RegistrationFailed"
  | "DeregistrationRequested"
  | "DeregistrationInitiated"
  | "DeregistrationConfirmed"
  | "DeregistrationFailed";

export interface RegistryEntry {
  id: string;
  name: string;
  description: string | null;
  apiBaseUrl: string;
  state: RegistryRequestState;
  agentIdentifier: string | null;
  createdAt: string;
  updatedAt: string;
  Capability: { name: string | null; version: string | null };
  Author: {
    name: string;
    contactEmail: string | null;
    contactOther: string | null;
    organization: string | null;
  };
  Tags: string[];
  AgentPricing:
    | { pricingType: "Fixed"; Pricing: Array<{ unit: string; amount: string }> }
    | { pricingType: "Free" };
  SmartContractWallet?: { walletVkey: string; walletAddress: string };
}

export interface RegisterAgentInput {
  network: PaymentNodeNetwork;
  sellingWalletVkey: string;
  name: string;
  apiBaseUrl: string;
  description: string;
  Tags: string[];
  ExampleOutputs: Array<{ name: string; url: string; mimeType: string }>;
  Capability: { name: string; version: string };
  Author: {
    name: string;
    contactEmail?: string;
    contactOther?: string;
    organization?: string;
  };
  Legal?: { privacyPolicy?: string; terms?: string; other?: string };
  AgentPricing:
    | { pricingType: "Free" }
    | {
        pricingType: "Fixed";
        Pricing: Array<{ unit: string; amount: string }>;
      };
}

export interface DeregisterAgentInput {
  network: PaymentNodeNetwork;
  agentIdentifier: string;
  smartContractAddress?: string;
}

export interface CreateApiKeyInput {
  permission: "Read" | "ReadAndPay" | "Admin";
  networkLimit: PaymentNodeNetwork[];
  /** Payment node API expects the string "true"/"false", not a boolean. */
  usageLimited: "true" | "false";
  UsageCredits: Array<{ unit: string; amount: string }>;
}

export interface CreateApiKeyOutput {
  id: string;
  token: string;
  permission: string;
  usageLimited: boolean;
  networkLimit: PaymentNodeNetwork[];
  RemainingUsageCredits: Array<{ unit: string; amount: string }>;
  status: string;
}

export interface AddWalletToSourceInput {
  paymentSourceId: string;
  AddSellingWallets?: Array<{
    walletMnemonic: string;
    note: string;
    collectionAddress: string | null;
  }>;
  AddPurchasingWallets?: Array<{
    walletMnemonic: string;
    note: string;
    collectionAddress: string | null;
  }>;
}

export interface PaymentSourceWallet {
  id: string;
  walletVkey: string;
  walletAddress: string;
  collectionAddress: string | null;
  note: string | null;
}

export interface AddWalletToSourceOutput {
  id: string;
  SellingWallets: PaymentSourceWallet[];
  PurchasingWallets: PaymentSourceWallet[];
}

export interface WalletStatus {
  note: string | null;
  walletVkey: string;
  walletAddress: string;
  collectionAddress: string | null;
  PendingTransaction: {
    createdAt: string;
    updatedAt: string;
    hash: string | null;
    lastCheckedAt: string | null;
  } | null;
}

export interface GeneratedWallet {
  walletMnemonic: string;
  walletAddress: string;
  walletVkey: string;
}

export interface UtxoAmount {
  unit: string;
  quantity: number;
}

export interface Utxo {
  txHash: string;
  address: string;
  Amounts: UtxoAmount[];
  dataHash: string | null;
  inlineDatum: string | null;
  referenceScriptHash: string | null;
  outputIndex: number;
  block: string;
}

export interface GetUtxosOutput {
  Utxos: Utxo[];
}

// ─── Client factory ─────────────────────────────────────────────────────────

export function createPaymentNodeClient(baseUrl: string, apiKey: string) {
  const base = baseUrl.replace(/\/$/, "");

  return {
    /** Register an agent (pay-authenticated). Use user's API key. */
    async registerAgent(body: RegisterAgentInput): Promise<RegistryEntry> {
      return request<RegistryEntry>(base, apiKey, `/registry`, {
        method: "POST",
        body,
      });
    },

    /** Deregister an agent (pay-authenticated). Use user's API key. */
    async deregisterAgent(body: DeregisterAgentInput): Promise<RegistryEntry> {
      return request<RegistryEntry>(base, apiKey, `/registry/deregister`, {
        method: "POST",
        body,
      });
    },

    /** Permanently delete a registry entry from the payment node DB (admin only).
     *  Only valid for RegistrationFailed or DeregistrationConfirmed entries. */
    async deleteRegistryEntry(id: string): Promise<RegistryEntry> {
      return request<RegistryEntry>(base, apiKey, `/registry`, {
        method: "DELETE",
        body: { id },
      });
    },

    /** List registry requests (pay-authenticated). Use user's API key. */
    async getRegistry(params: {
      network: PaymentNodeNetwork;
      cursorId?: string;
    }): Promise<{ Assets: RegistryEntry[] }> {
      return request<{ Assets: RegistryEntry[] }>(base, apiKey, `/registry`, {
        method: "GET",
        query: {
          network: params.network,
          ...(params.cursorId && { cursorId: params.cursorId }),
        },
      });
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
      const json = (await res.json()) as PaymentNodeResponse<RegistryEntry>;
      return json.status === "success" && "data" in json
        ? (json.data as RegistryEntry)
        : null;
    },

    /** Create a new API key (admin only). Returns the raw token once — store it encrypted. */
    async createApiKey(body: CreateApiKeyInput): Promise<CreateApiKeyOutput> {
      return request<CreateApiKeyOutput>(base, apiKey, `/api-key`, {
        method: "POST",
        body: {
          ...body,
          UsageCredits: body.UsageCredits,
        },
      });
    },

    /** Add selling/purchasing wallets to an existing payment source (admin only). */
    async addWalletsToPaymentSource(
      body: AddWalletToSourceInput,
    ): Promise<AddWalletToSourceOutput> {
      return request<AddWalletToSourceOutput>(
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
      );
    },

    /** Get wallet status by ID (admin only). */
    async getWalletStatus(params: {
      walletType: "Selling" | "Buying";
      id: string;
    }): Promise<WalletStatus> {
      return request<WalletStatus>(base, apiKey, `/wallet`, {
        method: "GET",
        query: { walletType: params.walletType, id: params.id },
      });
    },

    /** Generate a new wallet (admin only). Does NOT persist on payment node; use addWalletsToPaymentSource to persist. */
    async generateWallet(
      network: PaymentNodeNetwork,
    ): Promise<GeneratedWallet> {
      return request<GeneratedWallet>(base, apiKey, `/wallet`, {
        method: "POST",
        body: { network },
      });
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
      return request<GetUtxosOutput>(base, apiKey, `/utxos`, {
        method: "GET",
        query: {
          address: params.address,
          network: params.network,
          ...(params.count != null && { count: String(params.count) }),
          ...(params.page != null && { page: String(params.page) }),
          ...(params.order != null && { order: params.order }),
        },
      });
    },
  };
}

export type PaymentNodeClient = ReturnType<typeof createPaymentNodeClient>;
