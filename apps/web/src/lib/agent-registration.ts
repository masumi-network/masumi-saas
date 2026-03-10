/**
 * Shared agent registration logic for on-chain registration.
 * Used by POST /api/agents.
 * No "use server" — receives user and params from callers.
 */

import prisma, { type RegistrationState } from "@masumi/database/client";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import {
  createPaymentNodeClient,
  paymentNodeConfig,
  type PaymentNodeNetwork,
  type RegisterAgentInput,
} from "@/lib/payment-node";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { USDM } from "@/lib/payment-node/tokens";

type Agent = Awaited<ReturnType<typeof prisma.agent.findUniqueOrThrow>>;

const DEFAULT_NETWORK: PaymentNodeNetwork = "Preprod";
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 18_000;
const REGISTER_AGENT_HTTP_TIMEOUT_MS = 25_000;

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

export type RegisterAgentResult =
  | { success: true; data: Agent }
  | { success: false; error: string }
  | { success: false; error: "WALLET_FUNDING_PENDING"; agentId: string };

export type CompleteRegistrationResult =
  | { status: "registered"; data: Agent }
  | { status: "pending" }
  | { status: "error"; error: string };

type RegistrationPayloadStored = {
  sellingWalletAddress?: string;
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

/**
 * Full on-chain registration: create agent, wallets, ref, wait for funding, registerAgent, update.
 * Caller must pass authenticated user and network (e.g. from API route or server action).
 */
export async function registerAgentOnChain(
  ctx: RegisterAgentContext,
  params: RegisterAgentParams,
): Promise<RegisterAgentResult> {
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
    paymentSourceId = paymentNodeConfig.getPaymentSourceId();
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

  const [sellingWallet, buyingWallet] = await Promise.all([
    adminClient.generateWallet(network),
    adminClient.generateWallet(network),
  ]);

  const paymentSource = await adminClient.addWalletsToPaymentSource({
    paymentSourceId,
    AddSellingWallets: [
      {
        walletMnemonic: sellingWallet.walletMnemonic,
        note: `Agent: ${params.name} (selling)`,
        collectionAddress: null,
      },
    ],
    AddPurchasingWallets: [
      {
        walletMnemonic: buyingWallet.walletMnemonic,
        note: `Agent: ${params.name} (buying)`,
        collectionAddress: null,
      },
    ],
  });

  const sellingWalletId =
    paymentSource.SellingWallets.find(
      (w) => w.walletVkey === sellingWallet.walletVkey,
    )?.id ?? null;

  if (network === "Preprod") {
    const DISPENSER_TIMEOUT_MS = 15_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      DISPENSER_TIMEOUT_MS,
    );
    try {
      const res = await fetch(
        "https://dispenser.masumi.network/submit_transaction",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            network: "testnet",
            receiverAddress: sellingWallet.walletAddress,
            lovelaceAmount: 10_000_000,
            assetAmount: 1_000_000,
            testnet_collateral: false,
          }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("[Dispenser] Non-OK response:", res.status, text);
        return {
          success: false,
          error:
            "Wallet funding request failed. The dispenser may be unavailable — please try again.",
        };
      }
    } catch (dispenserErr) {
      clearTimeout(timeoutId);
      const msg =
        dispenserErr instanceof Error
          ? dispenserErr.message
          : String(dispenserErr);
      console.warn("[Dispenser] Failed to fund selling wallet:", msg);
      return {
        success: false,
        error:
          "Could not reach the wallet dispenser. Please try again in a moment.",
      };
    }
  }

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
      buyingWalletVkey: buyingWallet.walletVkey,
      networkIdentifier: network,
      status: "PENDING",
      metadata: {
        sellingWalletAddress: sellingWallet.walletAddress,
        registrationPayload,
      },
    },
  });

  await recordAgentActivityEvent(agent.id, "RegistrationInitiated");

  const pollStart = Date.now();
  let walletFunded = false;

  while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
    try {
      const { Utxos } = await userClient.getUtxos({
        address: sellingWallet.walletAddress,
        network,
      });
      if (Utxos.length > 0) {
        walletFunded = true;
        break;
      }
    } catch (utxoError) {
      const msg =
        utxoError instanceof Error ? utxoError.message : String(utxoError);
      if (!msg.startsWith("404")) {
        await prisma.agent
          .delete({ where: { id: agent.id } })
          .catch(() => null);
        throw utxoError;
      }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  if (!walletFunded) {
    return {
      success: false,
      error: "WALLET_FUNDING_PENDING",
      agentId: agent.id,
    };
  }

  const registerPayload: RegisterAgentInput = {
    network,
    sellingWalletVkey: sellingWallet.walletVkey,
    name: params.name,
    apiBaseUrl: params.apiUrl,
    description: params.description?.trim() ?? "",
    Tags: params.tags,
    ExampleOutputs: params.exampleOutputs,
    Capability: {
      name: params.capabilityName,
      version: params.capabilityVersion,
    },
    Author: {
      name: user.name?.trim() || "Unknown",
      contactEmail: user.email ?? undefined,
      contactOther: undefined,
      organization: undefined,
    },
    ...(params.termsOfUseUrl || params.privacyPolicyUrl || params.otherUrl
      ? {
          Legal: {
            terms: params.termsOfUseUrl ?? undefined,
            privacyPolicy: params.privacyPolicyUrl ?? undefined,
            other: params.otherUrl ?? undefined,
          },
        }
      : {}),
    AgentPricing: params.agentPricing,
  };

  let registryEntry;
  try {
    registryEntry = await userClient.registerAgent(registerPayload);
  } catch (paymentNodeError) {
    await prisma.agent.delete({ where: { id: agent.id } }).catch(() => null);
    throw paymentNodeError;
  }

  const existingRef = await prisma.agentReference.findUnique({
    where: { agentId: agent.id },
    select: { metadata: true },
  });
  const existingMeta =
    (existingRef?.metadata as Record<string, unknown> | null) ?? {};
  await prisma.agentReference.update({
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

  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      registrationState: registryEntry.state as RegistrationState,
      ...(registryEntry.agentIdentifier && {
        agentIdentifier: registryEntry.agentIdentifier,
      }),
    },
  });

  if (registryEntry.state === "RegistrationConfirmed") {
    await recordAgentActivityEvent(agent.id, "RegistrationConfirmed");
  } else if (registryEntry.state === "RegistrationFailed") {
    await recordAgentActivityEvent(agent.id, "RegistrationFailed");
  }

  const updatedAgent = await prisma.agent.findUniqueOrThrow({
    where: { id: agent.id },
  });

  return { success: true, data: updatedAgent };
}

/**
 * Complete on-chain registration for an agent that is in WALLET_FUNDING_PENDING.
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
    return { status: "registered", data: updated ?? agent };
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
  const sellingWalletVkey = ref.sellingWalletVkey;
  if (!sellingWalletVkey) {
    return { status: "error", error: "Missing wallet key" };
  }
  try {
    const { Utxos } = await userClient.getUtxos({ address, network });
    if (Utxos.length === 0) {
      return { status: "pending" };
    }
  } catch (utxoErr) {
    const msg = utxoErr instanceof Error ? utxoErr.message : String(utxoErr);
    if (msg.startsWith("404")) return { status: "pending" };
    return { status: "error", error: msg };
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
      return { agent: existing, eventType: null };
    }
    const registerPromise = userClient.registerAgent({
      network,
      sellingWalletVkey,
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
      const existingMeta =
        (ref.metadata as Record<string, unknown> | null) ?? {};
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
      return { agent: updated, eventType };
    } finally {
      clearTimeout(timeoutId!);
    }
  });
  if (updatedAgent.eventType) {
    await recordAgentActivityEvent(agent.id, updatedAgent.eventType);
  }
  return { status: "registered", data: updatedAgent.agent };
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
