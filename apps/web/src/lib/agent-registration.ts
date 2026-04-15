/**
 * Shared agent registration logic for on-chain registration.
 * Used by POST /api/agents.
 * No "use server" — receives user and params from callers.
 */

import prisma, { type RegistrationState } from "@masumi/database/client";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { sendAgentRegistrationCompleteEmail } from "@/lib/email/send-registration-complete";
import { sendAgentRegistrationFailedEmail } from "@/lib/email/send-registration-failed";
import {
  createPaymentNodeClient,
  paymentNodeConfig,
  type PaymentNodeNetwork,
} from "@/lib/payment-node";
import type { PaymentSourceWallet } from "@/lib/payment-node/client";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
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

export type AgentPricing =
  | { pricingType: "Free" }
  | {
      pricingType: "Fixed";
      Pricing: Array<{ unit: string; amount: string }>;
    };

export type RegisterAgentParams = {
  name: string;
  description: string | null;
  extendedDescription: string | null;
  apiUrl: string;
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
  mintingWalletAddress?: string;
  mintingWalletId?: string;
  mintingWalletVkey?: string;
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
  try {
    baseUrl = paymentNodeConfig.getBaseUrl();
    adminKey = paymentNodeConfig.getAdminApiKey();
    paymentSourceId = paymentNodeConfig.getPaymentSourceId(network);
  } catch (e) {
    console.error("Payment node config missing:", e);
    return {
      success: false,
      error: "Something went wrong. Please try again later.",
    };
  }

  if (network === "Mainnet") {
    return {
      success: false,
      error:
        "Agent registration on Mainnet is not available yet. Please use Preprod for now.",
    };
  }

  const adminClient = createPaymentNodeClient(baseUrl, adminKey);

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
      error: `Configured payment source ${paymentSourceId} is on ${paymentSource.network}, but agent registration is using ${network}. Update ${paymentNodeConfig.getPaymentSourceIdEnvName(network)} to a ${network} payment source.`,
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

  const sellingWalletId =
    paymentSource.SellingWallets.find(
      (w: PaymentSourceWallet) => w.walletVkey === sellingWallet.walletVkey,
    )?.id ?? null;
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

  const fundingWalletResult = resolveRegistrationFundingWallet({
    network,
    paymentSourceId,
    sellingWallets: paymentSource.SellingWallets,
  });
  if (!fundingWalletResult.wallet) {
    return {
      success: false,
      error:
        fundingWalletResult.error ??
        "No registration funding wallet is available for this payment source.",
    };
  }
  const fundingWallet = fundingWalletResult.wallet;

  try {
    await ensureUserPaymentNodeKeyScopedToWallets({
      userId: user.id,
      walletIds: [sellingWalletId, fundingWallet.id],
    });
  } catch (error) {
    console.error("[Payment Node] Failed to scope user key for agent wallet:", {
      userId: user.id,
      sellingWalletId,
      fundingWalletId: fundingWallet.id,
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
      name: params.name,
      description: params.description,
      extendedDescription: params.extendedDescription,
      apiUrl: params.apiUrl,
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
        mintingWalletAddress: fundingWallet.walletAddress,
        mintingWalletId: fundingWallet.id,
        mintingWalletVkey: fundingWallet.walletVkey,
        ...(paymentSource.smartContractAddress && {
          smartContractAddress: paymentSource.smartContractAddress,
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
    const userClient = await getPaymentNodeClientForUser(userId);
    if (userClient) {
      try {
        const entry = await userClient.getRegistryById({
          id: ref.externalId,
          network,
        });
        if (entry) {
          const state = entry.state as RegistrationState;
          await prisma.agent.update({
            where: { id: agentId },
            data: {
              registrationState: state,
              ...(entry.agentIdentifier && {
                agentIdentifier: entry.agentIdentifier,
              }),
            },
          });
          if (state === "RegistrationConfirmed") {
            await recordAgentActivityEvent(agentId, "RegistrationConfirmed");
            const fresh = await prisma.agent.findUniqueOrThrow({
              where: { id: agentId },
            });
            await sendAgentRegistrationCompleteEmail(
              userId,
              agentId,
              fresh.name,
            );
            return { status: "registered", data: fresh };
          }
          if (state === "RegistrationFailed") {
            await recordAgentActivityEvent(agentId, "RegistrationFailed");
            const errorMsg =
              "Registration was rejected or failed on the network.";
            await sendAgentRegistrationFailedEmail(
              userId,
              agentId,
              agent.name,
              errorMsg,
            );
            return { status: "error", error: errorMsg };
          }
        }
      } catch {
        // Non-fatal: fall through to return pending
      }
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
  const mintingWalletVkey =
    typeof meta.mintingWalletVkey === "string"
      ? meta.mintingWalletVkey
      : recipientWalletVkey;

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

    const registerPromise = userClient.registerAgent({
      network,
      sellingWalletVkey: mintingWalletVkey,
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
            ...(registryEntry.agentIdentifier && {
              agentIdentifier: registryEntry.agentIdentifier,
            }),
          },
        },
      });
      await tx.agent.update({
        where: { id: agent.id },
        data: {
          registrationState: registryEntry.state as RegistrationState,
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
        pricingType: "Free" | "Fixed";
        prices?: Array<{ amount: string; currency?: string }>;
      }
    | null
    | undefined,
): AgentPricing {
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
