/**
 * Shared agent registration logic for on-chain registration.
 * Used by POST /api/agents.
 * No "use server" — receives user and params from callers.
 */

import prisma from "@masumi/database/client";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { registrationStateFromRegistryEntry } from "@/lib/agents/registration-state";
import { sendAgentRegistrationCompleteEmail } from "@/lib/email/send-registration-complete";
import { sendAgentRegistrationFailedEmail } from "@/lib/email/send-registration-failed";
import {
  createPaymentNodeClient,
  paymentNodeConfig,
  type PaymentNodeNetwork,
} from "@/lib/payment-node";
import type {
  PaymentSourceInfo,
  PaymentSourceWallet,
} from "@/lib/payment-node/client";
import { isPaymentNodeConfigError } from "@/lib/payment-node/config";
import {
  createAdminPaymentNodeClient,
  tryCreateAdminPaymentNodeClient,
} from "@/lib/payment-node/get-admin-client";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import {
  findSellingWalletIdByVkey,
  hydratePaymentSource,
} from "@/lib/payment-node/payment-source-wallets";
import { getRegistryEntryForSync } from "@/lib/payment-node/resolve-registry-entry-for-sync";
import type { RegistryEntry } from "@/lib/payment-node/schemas";
import { USDM } from "@/lib/payment-node/tokens";
import { ensureUserPaymentNodeKeyScopedToWallets } from "@/lib/payment-node/wallet-scopes";

import {
  isWalletAddressCompatibleWithNetwork,
  resolveRegistrationFundingWallet,
} from "./payment-node/registration-wallets";

type Agent = Awaited<ReturnType<typeof prisma.agent.findUniqueOrThrow>>;

const DEFAULT_NETWORK: PaymentNodeNetwork = "Preprod";
const REGISTER_AGENT_HTTP_TIMEOUT_MS = 60_000;
const REGISTER_AGENT_RETRY_COOLDOWN_MS = 2 * 60_000;
const PAYMENT_SOURCE_PAGE_SIZE = 100;
const MAX_PAYMENT_SOURCE_PAGES = 10;

export type AgentPricing =
  | { pricingType: "Free" }
  | { pricingType: "Dynamic" }
  | {
      pricingType: "Fixed";
      Pricing: Array<{ unit: string; amount: string }>;
    };

export type RegisterAgentParams = {
  id?: string;
  name: string;
  description: string | null;
  extendedDescription: string | null;
  apiUrl: string;
  runtimeProvider?: "DIRECT_MIP" | "LANGDOCK";
  integrationConnectionId?: string | null;
  providerConfig?: Record<string, unknown> | null;
  tags: string[];
  icon: string | null;
  agentPricing: AgentPricing;
  exampleOutputs: Array<{ name: string; url: string; mimeType: string }>;
  capabilityName: string;
  capabilityVersion: string;
  termsOfUseUrl?: string | null;
  privacyPolicyUrl?: string | null;
  otherUrl?: string | null;
};

export type RegisterAgentContext = {
  user: { id: string; name: string | null; email: string | null };
  activeOrganizationId: string | null;
  network: PaymentNodeNetwork;
};

/** Result of startAgentRegistration: fast path that returns 202 with agentId for background completion. */
export type StartAgentRegistrationResult =
  | { success: true; agentId: string }
  | { success: false; error: string };

export type CompleteRegistrationResult =
  | { status: "registered"; data: Agent }
  | { status: "pending" }
  | { status: "error"; error: string };

type RegistrationPayloadStored = {
  sellingWalletAddress?: string;
  fundingWalletId?: string;
  fundingWalletVkey?: string;
  fundingWalletAddress?: string;
  /** Payment source contract used for registry ops (deregister must match). */
  smartContractAddress?: string;
  lastRegisterAttemptAt?: string;
  registrationPayload?: {
    exampleOutputs: Array<{ name: string; url: string; mimeType: string }>;
    capabilityName: string;
    capabilityVersion: string;
    authorName: string;
    authorEmail?: string;
    organization?: string;
    contactOther?: string;
    termsOfUseUrl?: string;
    privacyPolicyUrl?: string;
    otherUrl?: string;
    agentPricing: AgentPricing;
  };
};

function shouldDeferRegisterRetry(lastRegisterAttemptAt?: string): boolean {
  if (!lastRegisterAttemptAt) return false;
  const ms = Date.parse(lastRegisterAttemptAt);
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms < REGISTER_AGENT_RETRY_COOLDOWN_MS;
}

export function shouldCheckRecipientWalletForRegisteredAssets(
  lastRegisterAttemptAt?: string,
): boolean {
  if (!lastRegisterAttemptAt) return false;
  return !Number.isNaN(Date.parse(lastRegisterAttemptAt));
}

function shouldTreatWalletRegistryLookupAsPending(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.startsWith("404: asset not found") ||
    normalized.startsWith("404: stake address not found") ||
    normalized.includes("requested component has not been found")
  );
}

async function completeRegistrationFromRegistryEntry(params: {
  agentId: string;
  userId: string;
  agentName: string;
  entry: RegistryEntry;
}): Promise<CompleteRegistrationResult> {
  const state = registrationStateFromRegistryEntry(params.entry.state);
  await prisma.agent.update({
    where: { id: params.agentId },
    data: {
      registrationState: state,
      ...(params.entry.agentIdentifier && {
        agentIdentifier: params.entry.agentIdentifier,
      }),
    },
  });
  if (state === "RegistrationConfirmed") {
    await recordAgentActivityEvent(params.agentId, "RegistrationConfirmed");
    const fresh = await prisma.agent.findUniqueOrThrow({
      where: { id: params.agentId },
    });
    await sendAgentRegistrationCompleteEmail(
      params.userId,
      params.agentId,
      fresh.name,
    );
    return { status: "registered", data: fresh };
  }
  if (state === "RegistrationFailed") {
    await recordAgentActivityEvent(params.agentId, "RegistrationFailed");
    const errorMsg = "Registration was rejected or failed on the network.";
    await sendAgentRegistrationFailedEmail(
      params.userId,
      params.agentId,
      params.agentName,
      errorMsg,
    );
    return { status: "error", error: errorMsg };
  }
  if (state === "UpdateFailed") {
    return {
      status: "error",
      error: "Registry update failed on the payment node.",
    };
  }
  return { status: "pending" };
}

async function trySyncFromRecipientWalletAssets(params: {
  userId: string;
  agentId: string;
  agentName: string;
  agentApiUrl: string;
  recipientWalletVkey: string;
  network: PaymentNodeNetwork;
  existingMetadata: Record<string, unknown> | null;
}): Promise<CompleteRegistrationResult | null> {
  const clients = [
    await getPaymentNodeClientForUser(params.userId),
    tryCreateAdminPaymentNodeClient(),
  ].filter((client): client is ReturnType<typeof createPaymentNodeClient> =>
    Boolean(client),
  );

  for (const client of clients) {
    try {
      const response = await client.getRegisteredAgentsByWallet({
        walletVkey: params.recipientWalletVkey,
        network: params.network,
      });
      const walletMatch =
        response.Assets.find(
          (asset) => asset.Metadata.apiBaseUrl === params.agentApiUrl,
        ) ??
        response.Assets.find(
          (asset) => asset.Metadata.name === params.agentName,
        ) ??
        null;
      if (!walletMatch?.agentIdentifier) continue;

      await prisma.agentReference.update({
        where: { agentId: params.agentId },
        data: {
          status: "ACTIVE",
          registeredAt: new Date(),
          metadata: {
            ...(params.existingMetadata ?? {}),
            agentIdentifier: walletMatch.agentIdentifier,
          },
        },
      });
      await prisma.agent.update({
        where: { id: params.agentId },
        data: {
          registrationState: "RegistrationConfirmed",
          agentIdentifier: walletMatch.agentIdentifier,
        },
      });
      await recordAgentActivityEvent(params.agentId, "RegistrationConfirmed");
      const fresh = await prisma.agent.findUniqueOrThrow({
        where: { id: params.agentId },
      });
      await sendAgentRegistrationCompleteEmail(
        params.userId,
        params.agentId,
        fresh.name,
      );
      return { status: "registered", data: fresh };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!shouldTreatWalletRegistryLookupAsPending(message)) {
        continue;
      }
    }
  }

  return null;
}

async function getConfiguredPaymentSource(
  client: ReturnType<typeof createPaymentNodeClient>,
  paymentSourceId: string,
): Promise<PaymentSourceInfo | null> {
  let cursorId: string | undefined;

  for (let page = 0; page < MAX_PAYMENT_SOURCE_PAGES; page += 1) {
    const result = await client.getPaymentSources({
      take: PAYMENT_SOURCE_PAGE_SIZE,
      cursorId,
    });
    const match =
      result.PaymentSources.find((source) => source.id === paymentSourceId) ??
      null;
    if (match) return match;

    if (result.PaymentSources.length < PAYMENT_SOURCE_PAGE_SIZE) {
      break;
    }

    const nextCursor = result.PaymentSources.at(-1)?.id;
    if (!nextCursor || nextCursor === cursorId) {
      break;
    }
    cursorId = nextCursor;
  }

  return null;
}

function getPaymentSourceMismatchError(params: {
  paymentSourceId: string;
  expectedNetwork: PaymentNodeNetwork;
  actualNetwork: PaymentNodeNetwork;
}): string {
  return `Configured payment source ${params.paymentSourceId} is on ${params.actualNetwork}, but agent registration is using ${params.expectedNetwork}. Update ${paymentNodeConfig.getPaymentSourceIdEnvName(params.expectedNetwork)} to a ${params.expectedNetwork} payment source.`;
}

function validateRegistrationFundingWalletNetwork(params: {
  fundingWallet: PaymentSourceWallet;
  network: PaymentNodeNetwork;
}): string | null {
  if (
    isWalletAddressCompatibleWithNetwork(
      params.fundingWallet.walletAddress,
      params.network,
    )
  ) {
    return null;
  }

  console.error(
    "[Payment Node] Registration funding wallet network mismatch:",
    {
      walletAddress: params.fundingWallet.walletAddress,
      expectedNetwork: params.network,
    },
  );
  return `Configured registration funding wallet address does not match ${params.network}. Please verify ${params.network} payment-node wallet configuration and try again.`;
}

/**
 * Fast path: create agent wallet, ref, and persist funding-wallet context; return agentId immediately.
 * Completion (registerAgent + confirmation polling) is done by POST /api/agents/:id/complete-registration.
 */
export async function startAgentRegistration(
  ctx: RegisterAgentContext,
  params: RegisterAgentParams,
): Promise<StartAgentRegistrationResult> {
  const result = await registerAgentOnChainUntilSetup(ctx, params);
  if (!result.success) return result;
  return { success: true, agentId: result.agentId };
}

/**
 * Internal: does validation, wallet setup, funding-wallet resolution, agent + ref creation; returns agentId.
 */
async function registerAgentOnChainUntilSetup(
  ctx: RegisterAgentContext,
  params: RegisterAgentParams,
): Promise<
  { success: true; agentId: string } | { success: false; error: string }
> {
  const { user, activeOrganizationId, network } = ctx;

  if (params.tags.length === 0) {
    return { success: false, error: "At least one tag is required." };
  }

  const userClient = await getPaymentNodeClientForUser(user.id);
  if (!userClient) {
    return {
      success: false,
      error: "Something went wrong. Please try again in a moment.",
    };
  }

  let baseUrl: string;
  let adminKey: string;
  let paymentSourceId: string;
  const paymentSourceEnvName =
    paymentNodeConfig.getPaymentSourceIdEnvName(network);
  try {
    baseUrl = paymentNodeConfig.getBaseUrl();
    adminKey = paymentNodeConfig.getAdminApiKey();
    paymentSourceId = paymentNodeConfig.getPaymentSourceId(network);
  } catch (e) {
    if (isPaymentNodeConfigError(e) && e.envName === paymentSourceEnvName) {
      throw e;
    }
    console.error("Payment node config missing:", e);
    return {
      success: false,
      error: "Something went wrong. Please try again later.",
    };
  }

  const adminClient = createPaymentNodeClient(baseUrl, adminKey);

  const configuredPaymentSource = await getConfiguredPaymentSource(
    adminClient,
    paymentSourceId,
  );
  if (!configuredPaymentSource) {
    return {
      success: false,
      error: `Configured payment source ${paymentSourceId} could not be found for agent registration.`,
    };
  }

  if (
    configuredPaymentSource.network &&
    configuredPaymentSource.network !== network
  ) {
    console.error("[Payment Node] Payment source network mismatch:", {
      paymentSourceId,
      expectedNetwork: network,
      actualNetwork: configuredPaymentSource.network,
    });
    return {
      success: false,
      error: getPaymentSourceMismatchError({
        paymentSourceId,
        expectedNetwork: network,
        actualNetwork: configuredPaymentSource.network,
      }),
    };
  }

  const configuredPaymentSourceWithWallets = await hydratePaymentSource(
    adminClient,
    configuredPaymentSource,
  );

  const fundingWalletResult = resolveRegistrationFundingWallet({
    network,
    paymentSourceId,
    sellingWallets: configuredPaymentSourceWithWallets.SellingWallets,
  });
  if (!fundingWalletResult.wallet) {
    return {
      success: false,
      error:
        fundingWalletResult.error ??
        "No registration funding wallet is available for agent registration.",
    };
  }

  const fundingWalletNetworkError = validateRegistrationFundingWalletNetwork({
    fundingWallet: fundingWalletResult.wallet,
    network,
  });
  if (fundingWalletNetworkError) {
    return { success: false, error: fundingWalletNetworkError };
  }

  const sellingWallet = await adminClient.generateWallet(network);
  const paymentSource = await adminClient.addWalletsToPaymentSource({
    paymentSourceId,
    AddSellingWallets: [
      {
        walletMnemonic: sellingWallet.walletMnemonic,
        note: `Agent: ${params.name} (selling)`,
        collectionAddress: null,
      },
    ],
  });

  if (paymentSource.network && paymentSource.network !== network) {
    console.error("[Payment Node] Payment source network mismatch:", {
      paymentSourceId,
      expectedNetwork: network,
      actualNetwork: paymentSource.network,
    });
    return {
      success: false,
      error: getPaymentSourceMismatchError({
        paymentSourceId,
        expectedNetwork: network,
        actualNetwork: paymentSource.network,
      }),
    };
  }

  if (
    !isWalletAddressCompatibleWithNetwork(sellingWallet.walletAddress, network)
  ) {
    console.error("[Payment Node] Generated selling wallet network mismatch:", {
      walletAddress: sellingWallet.walletAddress,
      expectedNetwork: network,
    });
    return {
      success: false,
      error: `Generated selling wallet address does not match ${network}. Please verify the payment node wallet configuration and try again.`,
    };
  }

  const sellingWalletId = await findSellingWalletIdByVkey(
    adminClient,
    paymentSourceId,
    sellingWallet.walletVkey,
  );
  if (!sellingWalletId) {
    console.error(
      "[Payment Node] Could not resolve managed selling wallet ID:",
      {
        walletVkey: sellingWallet.walletVkey,
        paymentSourceId,
      },
    );
    return {
      success: false,
      error:
        "Could not attach the new agent wallet to your payment permissions. Please try again.",
    };
  }

  try {
    await ensureUserPaymentNodeKeyScopedToWallets({
      userId: user.id,
      walletIds: [sellingWalletId],
    });
  } catch (error) {
    console.error("[Payment Node] Failed to scope user key for agent wallet:", {
      userId: user.id,
      sellingWalletId,
      error,
    });
    return {
      success: false,
      error:
        "Could not update the payment permissions for the new agent wallet. Please try again.",
    };
  }

  const agentMetadata: Record<string, unknown> = {
    authorName: user.name?.trim() || "Unknown",
    authorEmail: user.email ?? undefined,
    organization: undefined,
    contactOther: undefined,
    termsOfUseUrl: params.termsOfUseUrl ?? undefined,
    privacyPolicyUrl: params.privacyPolicyUrl ?? undefined,
    otherUrl: params.otherUrl ?? undefined,
    capabilityName: params.capabilityName,
    capabilityVersion: params.capabilityVersion,
    exampleOutputs: params.exampleOutputs,
  };
  const metadataCleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(agentMetadata)) {
    if (v !== undefined) metadataCleaned[k] = v;
  }
  const agentMetadataJson =
    Object.keys(metadataCleaned).length > 0
      ? JSON.stringify(metadataCleaned)
      : null;

  const agent = await prisma.agent.create({
    data: {
      ...(params.id ? { id: params.id } : {}),
      name: params.name,
      description: params.description,
      extendedDescription: params.extendedDescription,
      apiUrl: params.apiUrl,
      runtimeProvider: params.runtimeProvider ?? "DIRECT_MIP",
      integrationConnectionId: params.integrationConnectionId ?? null,
      providerConfig: params.providerConfig ?? undefined,
      tags: params.tags,
      icon: params.icon,
      userId: user.id,
      organizationId: activeOrganizationId,
      registrationState: "RegistrationRequested",
      verificationStatus: "PENDING",
      pricing: params.agentPricing as Record<string, unknown>,
      networkIdentifier: network,
      metadata: agentMetadataJson,
    },
  });

  const registrationPayload = {
    exampleOutputs: params.exampleOutputs,
    capabilityName: params.capabilityName,
    capabilityVersion: params.capabilityVersion,
    authorName: user.name?.trim() || "Unknown",
    authorEmail: user.email ?? undefined,
    organization: undefined,
    contactOther: undefined,
    termsOfUseUrl: params.termsOfUseUrl ?? undefined,
    privacyPolicyUrl: params.privacyPolicyUrl ?? undefined,
    otherUrl: params.otherUrl ?? undefined,
    agentPricing: params.agentPricing,
  };

  await prisma.agentReference.create({
    data: {
      agentId: agent.id,
      sellingWalletVkey: sellingWallet.walletVkey,
      sellingWalletId,
      networkIdentifier: network,
      status: "PENDING",
      metadata: {
        sellingWalletAddress: sellingWallet.walletAddress,
        fundingWalletId: fundingWalletResult.wallet.id,
        fundingWalletVkey: fundingWalletResult.wallet.walletVkey,
        fundingWalletAddress: fundingWalletResult.wallet.walletAddress,
        paymentSourceId,
        ...((paymentSource.smartContractAddress ||
          configuredPaymentSource.smartContractAddress) && {
          smartContractAddress:
            paymentSource.smartContractAddress ??
            configuredPaymentSource.smartContractAddress,
        }),
        registrationPayload,
      },
    },
  });

  await recordAgentActivityEvent(agent.id, "RegistrationInitiated");

  return { success: true, agentId: agent.id };
}

/**
 * Complete on-chain registration for an agent that is waiting on registry submission or confirmation.
 * Caller must ensure the agent belongs to userId (e.g. from getAuthenticatedOrThrow).
 */
export async function completeOnChainRegistration(
  agentId: string,
  userId: string,
): Promise<CompleteRegistrationResult> {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId },
    include: { agentReference: true },
  });
  if (!agent?.agentReference) {
    return { status: "error", error: "Agent not found" };
  }
  const ref = agent.agentReference;
  if (ref.externalId) {
    const updated = await prisma.agent.findUnique({
      where: { id: agentId },
    });
    const current = updated ?? agent;
    if (current.registrationState === "RegistrationConfirmed") {
      return { status: "registered", data: current };
    }
    if (current.registrationState === "RegistrationFailed") {
      return {
        status: "error",
        error: "Registration was rejected or failed on the network.",
      };
    }
    const network = (ref.networkIdentifier ??
      DEFAULT_NETWORK) as PaymentNodeNetwork;
    const refMetaForSync = (ref.metadata ?? {}) as RegistrationPayloadStored;
    const smartContractAddress =
      refMetaForSync.smartContractAddress ??
      paymentNodeConfig.tryGetSmartContractAddress(network);
    const entry = await getRegistryEntryForSync({
      userId,
      externalId: ref.externalId,
      network,
      smartContractAddress,
    });
    if (entry) {
      return completeRegistrationFromRegistryEntry({
        agentId,
        userId,
        agentName: agent.name,
        entry,
      });
    }

    if (ref.sellingWalletVkey) {
      const walletSync = await trySyncFromRecipientWalletAssets({
        userId,
        agentId,
        agentName: agent.name,
        agentApiUrl: agent.apiUrl,
        recipientWalletVkey: ref.sellingWalletVkey,
        network,
        existingMetadata:
          (ref.metadata as Record<string, unknown> | null) ?? null,
      });
      if (walletSync) return walletSync;
    }

    return { status: "pending" };
  }
  const meta = (ref.metadata ?? {}) as RegistrationPayloadStored;
  const address = meta.sellingWalletAddress;
  const payload = meta.registrationPayload;
  if (!address || !payload) {
    return { status: "error", error: "Missing registration data" };
  }
  const network = (ref.networkIdentifier ??
    DEFAULT_NETWORK) as PaymentNodeNetwork;
  const userClient = await getPaymentNodeClientForUser(userId);
  if (!userClient) {
    return { status: "error", error: "Payment node unavailable" };
  }
  const recipientWalletVkey = ref.sellingWalletVkey;
  if (!recipientWalletVkey) {
    return { status: "error", error: "Missing wallet key" };
  }
  let adminClient: ReturnType<typeof createPaymentNodeClient>;
  let fundingWalletVkey =
    typeof meta.fundingWalletVkey === "string"
      ? meta.fundingWalletVkey.trim()
      : "";
  let paymentSourceId: string | null = null;
  try {
    adminClient = createAdminPaymentNodeClient();
    if (!fundingWalletVkey) {
      paymentSourceId = paymentNodeConfig.getPaymentSourceId(network);
    }
  } catch (error) {
    if (isPaymentNodeConfigError(error)) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
  if (!fundingWalletVkey) {
    const configuredPaymentSource = await getConfiguredPaymentSource(
      adminClient,
      paymentSourceId!,
    );
    if (!configuredPaymentSource) {
      return {
        status: "error",
        error: `Configured payment source ${paymentSourceId} could not be found for agent registration.`,
      };
    }
    const configuredPaymentSourceWithWallets = await hydratePaymentSource(
      adminClient,
      configuredPaymentSource,
    );
    const fundingWalletResult = resolveRegistrationFundingWallet({
      network,
      paymentSourceId: paymentSourceId!,
      sellingWallets: configuredPaymentSourceWithWallets.SellingWallets,
    });
    if (!fundingWalletResult.wallet) {
      return {
        status: "error",
        error:
          fundingWalletResult.error ??
          "No registration funding wallet is available for agent registration.",
      };
    }
    const fundingWalletNetworkError = validateRegistrationFundingWalletNetwork({
      fundingWallet: fundingWalletResult.wallet,
      network,
    });
    if (fundingWalletNetworkError) {
      return { status: "error", error: fundingWalletNetworkError };
    }
    fundingWalletVkey = fundingWalletResult.wallet.walletVkey;
  }

  const updatedAgent = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ externalId: string | null }>
    >`SELECT "externalId" FROM agent_reference WHERE "agentId" = ${agent.id} FOR UPDATE`;
    if (!rows.length) throw new Error("AgentReference not found");
    if (rows[0]!.externalId) {
      const existing = await tx.agent.findUniqueOrThrow({
        where: { id: agent.id },
      });
      return { agent: existing, eventType: null, pending: false };
    }
    const existingMeta = (ref.metadata as Record<string, unknown> | null) ?? {};

    let walletAssets: Awaited<
      ReturnType<typeof userClient.getRegisteredAgentsByWallet>
    >["Assets"] = [];
    const shouldCheckWalletAssets =
      shouldCheckRecipientWalletForRegisteredAssets(
        typeof meta.lastRegisterAttemptAt === "string"
          ? meta.lastRegisterAttemptAt
          : undefined,
      );
    if (shouldCheckWalletAssets) {
      try {
        const response = await userClient.getRegisteredAgentsByWallet({
          walletVkey: recipientWalletVkey,
          network,
        });
        walletAssets = response.Assets;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldTreatWalletRegistryLookupAsPending(message)) {
          walletAssets = [];
        } else {
          throw error;
        }
      }
    }
    const walletMatch =
      walletAssets.find(
        (asset) => asset.Metadata.apiBaseUrl === agent.apiUrl,
      ) ??
      walletAssets.find((asset) => asset.Metadata.name === agent.name) ??
      walletAssets[0] ??
      null;
    if (walletMatch) {
      await tx.agentReference.update({
        where: { agentId: agent.id },
        data: {
          status: "ACTIVE",
          registeredAt: new Date(),
          metadata: {
            ...existingMeta,
            agentIdentifier: walletMatch.agentIdentifier,
          },
        },
      });
      await tx.agent.update({
        where: { id: agent.id },
        data: {
          registrationState: "RegistrationConfirmed",
          agentIdentifier: walletMatch.agentIdentifier,
        },
      });
      const updated = await tx.agent.findUniqueOrThrow({
        where: { id: agent.id },
      });
      return {
        agent: updated,
        eventType: "RegistrationConfirmed" as const,
        pending: false,
      };
    }

    if (
      shouldDeferRegisterRetry(
        typeof meta.lastRegisterAttemptAt === "string"
          ? meta.lastRegisterAttemptAt
          : undefined,
      )
    ) {
      const existing = await tx.agent.findUniqueOrThrow({
        where: { id: agent.id },
      });
      return { agent: existing, eventType: null, pending: true };
    }

    const registerPromise = adminClient.registerAgent({
      network,
      sellingWalletVkey: fundingWalletVkey,
      recipientWalletAddress: address,
      name: agent.name,
      apiBaseUrl: agent.apiUrl,
      description: agent.description?.trim() ?? "",
      Tags: agent.tags,
      ExampleOutputs: payload.exampleOutputs,
      Capability: {
        name: payload.capabilityName,
        version: payload.capabilityVersion,
      },
      Author: {
        name: payload.authorName,
        contactEmail: payload.authorEmail,
        contactOther: payload.contactOther,
        organization: payload.organization,
      },
      ...(payload.termsOfUseUrl || payload.privacyPolicyUrl || payload.otherUrl
        ? {
            Legal: {
              terms: payload.termsOfUseUrl,
              privacyPolicy: payload.privacyPolicyUrl,
              other: payload.otherUrl,
            },
          }
        : {}),
      AgentPricing: payload.agentPricing,
    });
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Registration request timed out")),
        REGISTER_AGENT_HTTP_TIMEOUT_MS,
      );
    });
    try {
      const registryEntry = await Promise.race([
        registerPromise,
        timeoutPromise,
      ]);
      await tx.agentReference.update({
        where: { agentId: agent.id },
        data: {
          externalId: registryEntry.id,
          metadata: {
            ...existingMeta,
            ...(typeof existingMeta.fundingWalletVkey !== "string" && {
              fundingWalletVkey,
            }),
            ...(registryEntry.agentIdentifier && {
              agentIdentifier: registryEntry.agentIdentifier,
            }),
          },
        },
      });
      await tx.agent.update({
        where: { id: agent.id },
        data: {
          registrationState: registrationStateFromRegistryEntry(
            registryEntry.state,
          ),
          ...(registryEntry.agentIdentifier && {
            agentIdentifier: registryEntry.agentIdentifier,
          }),
        },
      });
      const eventType =
        registryEntry.state === "RegistrationConfirmed"
          ? ("RegistrationConfirmed" as const)
          : registryEntry.state === "RegistrationFailed"
            ? ("RegistrationFailed" as const)
            : null;
      const updated = await tx.agent.findUniqueOrThrow({
        where: { id: agent.id },
      });
      return { agent: updated, eventType, pending: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Network and Address combination not supported")) {
        throw new Error(
          `Payment source and wallet network mismatch. Registration is using ${network}. Check that ${paymentNodeConfig.getPaymentSourceIdEnvName(network)} points to a ${network} payment source.`,
        );
      }
      if (message.includes("Registration request timed out")) {
        await tx.agentReference.update({
          where: { agentId: agent.id },
          data: {
            metadata: {
              ...existingMeta,
              ...(typeof existingMeta.fundingWalletVkey !== "string" && {
                fundingWalletVkey,
              }),
              lastRegisterAttemptAt: new Date().toISOString(),
            },
          },
        });
        await tx.agent.update({
          where: { id: agent.id },
          data: {
            registrationState: "RegistrationInitiated",
          },
        });
        const updated = await tx.agent.findUniqueOrThrow({
          where: { id: agent.id },
        });
        return { agent: updated, eventType: null, pending: true };
      }
      throw error;
    } finally {
      clearTimeout(timeoutId!);
    }
  });
  if (updatedAgent.pending) {
    return { status: "pending" };
  }
  if (updatedAgent.eventType) {
    await recordAgentActivityEvent(agent.id, updatedAgent.eventType);
  }
  const state = updatedAgent.agent.registrationState;
  if (state === "RegistrationConfirmed") {
    await sendAgentRegistrationCompleteEmail(
      updatedAgent.agent.userId,
      updatedAgent.agent.id,
      updatedAgent.agent.name,
    );
    return { status: "registered", data: updatedAgent.agent };
  }
  if (state === "RegistrationFailed") {
    const errorMsg = "Registration was rejected or failed on the network.";
    await sendAgentRegistrationFailedEmail(
      updatedAgent.agent.userId,
      updatedAgent.agent.id,
      updatedAgent.agent.name,
      errorMsg,
    );
    return { status: "error", error: errorMsg };
  }
  return { status: "pending" };
}

/** Build AgentPricing for payment node from API/form pricing shape and network. */
export function buildAgentPricing(
  network: PaymentNodeNetwork,
  pricing:
    | {
        pricingType: "Free" | "Fixed" | "Dynamic";
        prices?: Array<{ amount: string; currency?: string }>;
      }
    | null
    | undefined,
): AgentPricing {
  if (pricing?.pricingType === "Dynamic") {
    return { pricingType: "Dynamic" };
  }
  const token = USDM[network];
  if (
    pricing?.pricingType === "Fixed" &&
    Array.isArray(pricing.prices) &&
    pricing.prices.length > 0
  ) {
    return {
      pricingType: "Fixed",
      Pricing: pricing.prices.map((p) => ({
        unit: token.unit,
        amount: String(Math.round(Number(p.amount) * 10 ** token.decimals)),
      })),
    };
  }
  return { pricingType: "Free" };
}
